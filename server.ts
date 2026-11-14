import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getActivePrescriptionAndMedicines,
  getCaregiverAlerts,
  getCaregiverProfile,
  getDemoMode,
  getPatientProfile,
  getTodaySchedule,
  getWeeklySummary,
  initDatabase,
  recordDoseAction,
  saveConfirmedPrescription,
  setDemoMode,
  updateMedicineExplanation,
  updatePatientProfile,
} from './server/db.js';
import {
  answerPrescriptionQuestion,
  extractPrescription,
  generatePlainExplanations,
  getSamplesList,
  MANDATORY_DOCTOR_LINE,
  synthesizeSpeechWav,
  transcribeQuestionAudio,
} from './server/gemini.js';
import {
  checkAndDispatchMissedDoseAlerts,
  dispatchEmergencyCaregiverAlert,
  isTwilioConfigured,
} from './server/notifications.js';
import { evaluatePrescriptionSafety, getCatalogInfo } from './server/safety.js';
import type { ExtractedMedicineInput, SupportedLanguage } from './server/types.js';

const PORT = Number(process.env.PORT || 3000);
const VALID_LANGUAGES = new Set<SupportedLanguage>(['en', 'hi', 'as', 'bn']);

initDatabase();

const app = express();
app.use(express.json({ limit: '12mb' }));

// Helper to build complete patient state payload
function buildBootstrapPayload() {
  const patient = getPatientProfile(1);
  const caregiver = getCaregiverProfile(1);
  const { prescription, medicines } = getActivePrescriptionAndMedicines(1);
  const schedule = getTodaySchedule(1);
  const weeklySummary = getWeeklySummary(1);
  const alerts = getCaregiverAlerts(1);
  const { overallWarnings } = evaluatePrescriptionSafety(
    medicines.map((m) => ({ name: m.name, activeIngredient: m.activeIngredient })),
    patient.conditions,
    patient.allergies
  );

  return {
    patient,
    caregiver,
    prescription,
    medicines,
    safetyWarnings: overallWarnings,
    schedule,
    weeklySummary,
    alerts,
    samples: getSamplesList(),
    demoMode: getDemoMode(),
    twilioConfigured: isTwilioConfigured(),
    catalogInfo: getCatalogInfo(),
    mandatoryDoctorLine: MANDATORY_DOCTOR_LINE[patient.language],
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ),
    twilioConfigured: isTwilioConfigured(),
    demoMode: getDemoMode(),
  });
});

app.get('/api/patient/bootstrap', (_req, res) => {
  try {
    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Failed to load patient data.' });
  }
});

app.patch('/api/patient/profile', (req, res) => {
  try {
    const { language, conditions, allergies } = req.body as {
      language?: SupportedLanguage;
      conditions?: string[];
      allergies?: string[];
    };

    if (language && !VALID_LANGUAGES.has(language)) {
      res.status(400).json({ error: 'Unsupported language code.' });
      return;
    }

    updatePatientProfile(1, {
      language,
      conditions: Array.isArray(conditions)
        ? conditions.map((c) => String(c).trim()).filter(Boolean)
        : undefined,
      allergies: Array.isArray(allergies)
        ? allergies.map((a) => String(a).trim()).filter(Boolean)
        : undefined,
    });

    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

app.post('/api/demo/toggle', (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  setDemoMode(enabled);
  res.json({ demoMode: getDemoMode() });
});

app.post('/api/prescriptions/scan', async (req, res) => {
  try {
    const { imageBase64, mimeType, sampleId } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      sampleId?: string;
    };

    if (!imageBase64 && !sampleId) {
      res.status(400).json({ error: 'Please upload a prescription photo or choose a sample.' });
      return;
    }

    const result = await extractPrescription({
      imageBase64,
      mimeType,
      sampleId,
      demoMode: getDemoMode(),
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read prescription image.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/prescriptions/confirm', async (req, res) => {
  try {
    const { title, sourceType, overallConfidence, medicines } = req.body as {
      title?: string;
      sourceType?: 'camera' | 'upload' | 'sample';
      overallConfidence?: 'high' | 'medium' | 'low';
      medicines?: ExtractedMedicineInput[];
    };

    if (!Array.isArray(medicines) || medicines.length === 0) {
      res.status(400).json({ error: 'At least one medicine must be confirmed.' });
      return;
    }

    const patient = getPatientProfile(1);
    const demoMode = getDemoMode();

    // Generate 6th-grade plain-language explanations in the patient's active language
    const explanations = await generatePlainExplanations(
      medicines.map((m) => ({
        name: m.name,
        activeIngredient: m.activeIngredient,
        strength: m.strength,
        doseAmount: m.doseAmount,
        slots: m.slots,
        foodTiming: m.foodTiming,
        durationDays: m.durationDays,
        specialInstructions: m.specialInstructions,
      })),
      patient.language,
      demoMode
    );

    const enriched = medicines.map((m, idx) => ({
      ...m,
      explanations: {
        [patient.language]: explanations[idx],
      },
    }));

    saveConfirmedPrescription(
      1,
      title || 'Verified Prescription',
      sourceType || 'upload',
      overallConfidence || 'high',
      enriched
    );

    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Confirm prescription error:', err);
    res.status(500).json({ error: 'Could not save verified prescription.' });
  }
});

app.post('/api/medicines/:id/explain', async (req, res) => {
  try {
    const medicineId = Number(req.params.id);
    const language = (req.body?.language || 'en') as SupportedLanguage;
    if (!VALID_LANGUAGES.has(language)) {
      res.status(400).json({ error: 'Unsupported language.' });
      return;
    }

    const { medicines } = getActivePrescriptionAndMedicines(1);
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) {
      res.status(404).json({ error: 'Medicine not found.' });
      return;
    }

    if (med.explanations[language]) {
      res.json({ explanation: med.explanations[language] });
      return;
    }

    const [generated] = await generatePlainExplanations([med], language, getDemoMode());
    updateMedicineExplanation(medicineId, language, generated);
    res.json({ explanation: generated });
  } catch (err) {
    console.error('Explain medicine error:', err);
    res.status(500).json({ error: 'Failed to generate medicine explanation.' });
  }
});

app.post('/api/medicines/explain-all', async (req, res) => {
  try {
    const language = (req.body?.language || 'en') as SupportedLanguage;
    if (!VALID_LANGUAGES.has(language)) {
      res.status(400).json({ error: 'Unsupported language.' });
      return;
    }

    const { medicines } = getActivePrescriptionAndMedicines(1);
    const missing = medicines.filter((m) => !m.explanations[language]);
    if (missing.length > 0) {
      const generated = await generatePlainExplanations(missing, language, getDemoMode());
      missing.forEach((m, idx) => {
        updateMedicineExplanation(m.id, language, generated[idx]);
      });
    }

    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Explain all error:', err);
    res.status(500).json({ error: 'Could not translate explanations.' });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text, language } = req.body as {
      text?: string;
      language?: SupportedLanguage;
    };
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required for speech.' });
      return;
    }

    const lang = VALID_LANGUAGES.has(language as SupportedLanguage)
      ? (language as SupportedLanguage)
      : 'en';

    // In Demo Mode, skip remote TTS latency if offline or prefer instant fallback;
    // when online and key is present, synthesize crisp Gemini WAV speech!
    const wav = await synthesizeSpeechWav(text, lang);
    if (!wav) {
      res.json({ fallback: 'webspeech', audioBase64: null });
      return;
    }

    res.json({ fallback: null, audioBase64: wav.audioBase64, mimeType: wav.mimeType });
  } catch (err) {
    console.warn('TTS route error:', err);
    res.json({ fallback: 'webspeech', audioBase64: null });
  }
});

app.post('/api/qa/ask', async (req, res) => {
  try {
    const { question, audioBase64, mimeType, language } = req.body as {
      question?: string;
      audioBase64?: string;
      mimeType?: string;
      language?: SupportedLanguage;
    };

    const patient = getPatientProfile(1);
    const lang = VALID_LANGUAGES.has(language as SupportedLanguage)
      ? (language as SupportedLanguage)
      : patient.language;

    let finalQuestion = (question || '').trim();
    if (!finalQuestion && audioBase64) {
      finalQuestion = await transcribeQuestionAudio(audioBase64, mimeType || 'audio/webm', lang);
    }

    if (!finalQuestion) {
      res.status(400).json({ error: 'Please type or speak a question about your medicines.' });
      return;
    }

    const { medicines } = getActivePrescriptionAndMedicines(1);
    const context = medicines
      .map(
        (m) =>
          `- ${m.name} ${m.strength}: ${m.doseAmount}, ${m.frequencyCode} (${m.slots.join('/')}), ${m.foodTiming.replace('_', ' ')}, ${m.durationDays} days. Notes: ${m.specialInstructions}`
      )
      .join('\n');

    const answer = await answerPrescriptionQuestion({
      question: finalQuestion,
      language: lang,
      prescriptionContext: context || 'No active prescription saved yet.',
      demoMode: getDemoMode(),
    });

    res.json({ question: finalQuestion, answer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not answer your question.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/doses/:id/action', (req, res) => {
  try {
    const doseId = Number(req.params.id);
    const action = req.body?.action as 'taken' | 'skipped';
    if (action !== 'taken' && action !== 'skipped') {
      res.status(400).json({ error: 'Action must be "taken" or "skipped".' });
      return;
    }
    recordDoseAction(doseId, 1, action);
    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Dose action error:', err);
    res.status(500).json({ error: 'Could not log dose action.' });
  }
});

app.get('/api/caregiver/dashboard', (_req, res) => {
  try {
    res.json(buildBootstrapPayload());
  } catch (err) {
    console.error('Caregiver dashboard error:', err);
    res.status(500).json({ error: 'Failed to load caregiver dashboard.' });
  }
});

app.post('/api/demo/fast-forward', async (_req, res) => {
  try {
    const alertResult = await checkAndDispatchMissedDoseAlerts(1, true);
    res.json({
      alertResult,
      bootstrap: buildBootstrapPayload(),
    });
  } catch (err) {
    console.error('Fast-forward alert error:', err);
    res.status(500).json({ error: 'Could not simulate missed-dose alert.' });
  }
});

app.post('/api/emergency/trigger', async (_req, res) => {
  try {
    const emergency = await dispatchEmergencyCaregiverAlert(1);
    res.json({
      emergency,
      bootstrap: buildBootstrapPayload(),
    });
  } catch (err) {
    console.error('Emergency trigger error:', err);
    res.status(500).json({ error: 'Could not send emergency caregiver alert.' });
  }
});

// Background 60-minute missed-dose monitor (checks every 60 seconds)
setInterval(() => {
  checkAndDispatchMissedDoseAlerts(1, false).catch((err) => {
    console.warn('Background reminder check error:', err);
  });
}, 60_000);

async function startServer() {
  if (process.env.NODE_ENV === 'production' && existsSync(join(process.cwd(), 'dist'))) {
    const distDir = join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediSathi running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediSathi server:', err);
  process.exit(1);
});
