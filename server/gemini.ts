import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { matchCatalogMedicines } from './safety.js';
import type {
  ConfidenceLevel,
  DoseSlot,
  ExtractedMedicineInput,
  FoodTiming,
  MedicineExplanation,
  SupportedLanguage,
} from './types.js';

interface SamplePrescription {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  clinicTitle: string;
  overallConfidence: ConfidenceLevel;
  medicines: Array<
    ExtractedMedicineInput & {
      explanations?: Partial<Record<SupportedLanguage, MedicineExplanation>>;
    }
  >;
}

const samplesJson = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'sample_prescriptions.json'), 'utf-8')
) as { samples: SamplePrescription[] };

export const MANDATORY_DOCTOR_LINE: Record<SupportedLanguage, string> = {
  en: 'Please confirm with your doctor or pharmacist.',
  hi: 'कृपया अपने डॉक्टर या फ़ार्मासिस्ट से पुष्टि जरूर करें।',
  as: 'অনুগ্ৰহ কৰি আপোনাৰ চিকিৎসক বা ফাৰ্মাচিষ্টৰ সৈতে নিশ্চিত কৰি ল’ব।',
  bn: 'অনুগ্রহ করে আপনার ডাক্তার বা ফার্মাসিস্টের সাথে নিশ্চিত করে নিন।',
};

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English (simple 6th-grade Indian English)',
  hi: 'Hindi (Devanagari script, simple everyday words)',
  as: 'Assamese (Assamese script, simple everyday words)',
  bn: 'Bengali (Bengali script, simple everyday words)',
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getSamplesList() {
  return samplesJson.samples.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    imageUrl: s.imageUrl,
    clinicTitle: s.clinicTitle,
  }));
}

export function findSampleById(sampleId: string): SamplePrescription | undefined {
  return samplesJson.samples.find((s) => s.id === sampleId);
}

/**
 * Extracts structured prescription medicines using Gemini Vision (`gemini-4-hydrogen`)
 * with strict JSON schema validation, or falls back to pre-computed sample JSON
 * when Demo Mode is enabled or the API is unavailable.
 */
export async function extractPrescription(options: {
  imageBase64?: string;
  mimeType?: string;
  sampleId?: string;
  demoMode: boolean;
}): Promise<{
  clinicTitle: string;
  overallConfidence: ConfidenceLevel;
  medicines: ExtractedMedicineInput[];
  usedFallback: boolean;
  notice?: string;
}> {
  const sample = options.sampleId ? findSampleById(options.sampleId) : undefined;

  if (options.demoMode && sample) {
    return {
      clinicTitle: sample.clinicTitle,
      overallConfidence: sample.overallConfidence,
      medicines: sample.medicines.map(({ explanations: _ex, ...rest }) => rest),
      usedFallback: true,
    };
  }

  let base64Data = options.imageBase64;
  let mimeType = options.mimeType || 'image/jpeg';

  if (!base64Data && sample) {
    try {
      const diskPath = join(process.cwd(), 'public', sample.imageUrl.replace(/^\//, ''));
      base64Data = readFileSync(diskPath).toString('base64');
      mimeType = 'image/jpeg';
    } catch {
      return {
        clinicTitle: sample.clinicTitle,
        overallConfidence: sample.overallConfidence,
        medicines: sample.medicines.map(({ explanations: _ex, ...rest }) => rest),
        usedFallback: true,
      };
    }
  }

  const ai = getGeminiClient();
  if (!ai || !base64Data) {
    if (sample) {
      return {
        clinicTitle: sample.clinicTitle,
        overallConfidence: sample.overallConfidence,
        medicines: sample.medicines.map(({ explanations: _ex, ...rest }) => rest),
        usedFallback: true,
        notice: 'Using offline sample prescription data.',
      };
    }
    throw new Error('No prescription image provided and Gemini API key is not configured.');
  }

  const cleanedBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanedBase64,
            },
          },
          {
            text: 'Read this prescription image carefully. Extract every prescribed medicine, strength, dose amount, frequency code (like 1-0-1), normalized daily slots (morning, afternoon, night), food timing (before_food, after_food, with_food, any), duration in days, special instructions, and confidence ("high", "medium", or "low"). Never guess illegible names; mark confidence "low" and explain in unclearReason.',
          },
        ],
      },
      config: {
        systemInstruction:
          'You are a careful medical prescription transcription assistant for patients in India. ONLY transcribe what is written on the image into strict JSON. Never diagnose, never invent illegible drug names, and never alter doses. If any handwriting is blurry or ambiguous, set confidence to "low" and explain why in unclearReason.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clinicTitle: {
              type: Type.STRING,
              description: 'Clinic or doctor name if visible, else "Uploaded Prescription".',
            },
            overallConfidence: {
              type: Type.STRING,
              description: 'One of: high, medium, low.',
            },
            medicines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  activeIngredient: { type: Type.STRING },
                  strength: { type: Type.STRING },
                  doseAmount: { type: Type.STRING },
                  frequencyCode: { type: Type.STRING },
                  slots: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  foodTiming: { type: Type.STRING },
                  durationDays: { type: Type.INTEGER },
                  specialInstructions: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                  unclearReason: { type: Type.STRING },
                },
                required: ['name', 'strength', 'doseAmount', 'frequencyCode', 'slots', 'foodTiming', 'durationDays', 'confidence'],
              },
            },
          },
          required: ['clinicTitle', 'overallConfidence', 'medicines'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      clinicTitle?: string;
      overallConfidence?: string;
      medicines?: Array<Record<string, unknown>>;
    };

    const validSlots = new Set<DoseSlot>(['morning', 'afternoon', 'night']);
    const validFood = new Set<FoodTiming>(['before_food', 'after_food', 'with_food', 'any']);
    const validConf = new Set<ConfidenceLevel>(['high', 'medium', 'low']);

    const normalizedMeds: ExtractedMedicineInput[] = (parsed.medicines ?? []).map((m, i) => {
      const rawSlots = Array.isArray(m.slots) ? m.slots.map(String) : ['morning'];
      const slots = rawSlots.filter((s): s is DoseSlot => validSlots.has(s as DoseSlot));
      const foodTiming = validFood.has(m.foodTiming as FoodTiming)
        ? (m.foodTiming as FoodTiming)
        : 'after_food';
      const confidence = validConf.has(m.confidence as ConfidenceLevel)
        ? (m.confidence as ConfidenceLevel)
        : 'medium';

      return {
        tempId: `med-${i + 1}`,
        name: String(m.name || 'Unclear Medicine').trim(),
        activeIngredient: String(m.activeIngredient || '').trim(),
        strength: String(m.strength || '').trim(),
        doseAmount: String(m.doseAmount || '1 tablet').trim(),
        frequencyCode: String(m.frequencyCode || '1-0-0').trim(),
        slots: slots.length > 0 ? slots : ['morning'],
        foodTiming,
        durationDays: Math.max(1, Number(m.durationDays) || 5),
        specialInstructions: String(m.specialInstructions || '').trim(),
        confidence,
        unclearReason: m.unclearReason ? String(m.unclearReason) : undefined,
      };
    });

    if (normalizedMeds.length === 0) {
      throw new Error('Could not detect any readable medicines in this image.');
    }

    const overallConfidence: ConfidenceLevel = validConf.has(
      parsed.overallConfidence as ConfidenceLevel
    )
      ? (parsed.overallConfidence as ConfidenceLevel)
      : normalizedMeds.some((m) => m.confidence === 'low')
        ? 'low'
        : 'high';

    return {
      clinicTitle: parsed.clinicTitle || 'Scanned Prescription',
      overallConfidence,
      medicines: normalizedMeds,
      usedFallback: false,
    };
  } catch (err) {
    console.warn('Gemini vision extraction failed, checking sample fallback:', err);
    if (sample) {
      return {
        clinicTitle: sample.clinicTitle,
        overallConfidence: sample.overallConfidence,
        medicines: sample.medicines.map(({ explanations: _ex, ...rest }) => rest),
        usedFallback: true,
        notice: 'Switched to pre-computed sample extraction because the live AI request failed.',
      };
    }
    throw err;
  }
}

/**
 * Generates deterministic fallback plain-language explanation if Gemini is offline/unavailable.
 */
export function buildFallbackExplanation(
  med: {
    name: string;
    activeIngredient?: string;
    doseAmount: string;
    slots: DoseSlot[];
    foodTiming: FoodTiming;
  },
  language: SupportedLanguage
): MedicineExplanation {
  // Check if any sample prescription already has a curated translation for this medicine name
  for (const sample of samplesJson.samples) {
    const match = sample.medicines.find(
      (sm) => sm.name.toLowerCase() === med.name.toLowerCase() && sm.explanations?.[language]
    );
    if (match?.explanations?.[language]) {
      return match.explanations[language]!;
    }
  }

  const catalog = matchCatalogMedicines(med.name, med.activeIngredient || '');
  const commonUseEn =
    catalog[0]?.commonUse ||
    'Generally used as prescribed by your doctor to support your treatment.';

  const slotLabels: Record<SupportedLanguage, Record<DoseSlot, string>> = {
    en: { morning: 'morning', afternoon: 'afternoon', night: 'night' },
    hi: { morning: 'सुबह', afternoon: 'दोपहर', night: 'रात' },
    as: { morning: 'ৰাতিপুৱা', afternoon: 'দুপৰীয়া', night: 'ৰাতি' },
    bn: { morning: 'সকালে', afternoon: 'দুপুরে', night: 'রাতে' },
  };

  const foodLabels: Record<SupportedLanguage, Record<FoodTiming, string>> = {
    en: {
      before_food: 'before food',
      after_food: 'after food',
      with_food: 'with food',
      any: 'with water',
    },
    hi: {
      before_food: 'खाने से पहले',
      after_food: 'खाने के बाद',
      with_food: 'खाने के साथ',
      any: 'पानी के साथ',
    },
    as: {
      before_food: 'আহাৰ খোৱাৰ আগতে',
      after_food: 'আহাৰ খোৱাৰ পাছত',
      with_food: 'আহাৰৰ সৈতে',
      any: 'পানীৰ সৈতে',
    },
    bn: {
      before_food: 'খাওয়ার আগে',
      after_food: 'খাওয়ার পরে',
      with_food: 'খাওয়ার সাথে',
      any: 'পানির সাথে',
    },
  };

  const whenStr = (med.slots.length > 0 ? med.slots : (['morning'] as DoseSlot[]))
    .map((s) => slotLabels[language][s])
    .join(', ');
  const foodStr = foodLabels[language][med.foodTiming || 'after_food'];

  if (language === 'hi') {
    return {
      usedFor: `${med.name}: ${commonUseEn}`,
      howAndWhen: `${whenStr} के समय ${foodStr} ${med.doseAmount} लें।`,
      whatToAvoid: 'अपने मन से खुराक न बदलें और एक साथ दो खुराक न लें।',
      whenToCallDoctor: `तेज चक्कर, खुजली या पेट में परेशानी हो तो डॉक्टर से बात करें। ${MANDATORY_DOCTOR_LINE.hi}`,
    };
  }
  if (language === 'as') {
    return {
      usedFor: `${med.name}: ${commonUseEn}`,
      howAndWhen: `${whenStr} সময়ত ${foodStr} ${med.doseAmount} খাওক।`,
      whatToAvoid: 'নিজেই পালি সলনি নকৰিব আৰু দুটা পালি একেলগে নাখাব।',
      whenToCallDoctor: `অস্বস্তি, খজুৱতি বা মূৰ ঘূৰোৱা হ’লে চিকিৎসকক জনাওক। ${MANDATORY_DOCTOR_LINE.as}`,
    };
  }
  if (language === 'bn') {
    return {
      usedFor: `${med.name}: ${commonUseEn}`,
      howAndWhen: `${whenStr} সময়ে ${foodStr} ${med.doseAmount} খাবেন।`,
      whatToAvoid: 'নিজে থেকে ডোজ বদলাবেন না এবং একসাথে দ্বিগুণ ওষুধ খাবেন না।',
      whenToCallDoctor: `অস্বস্তি, র‍্যাশ বা মাথা ঘোরার সমস্যা হলে ডাক্তারকে জানান। ${MANDATORY_DOCTOR_LINE.bn}`,
    };
  }

  return {
    usedFor: commonUseEn,
    howAndWhen: `Take ${med.doseAmount} in the ${whenStr}, ${foodStr}.`,
    whatToAvoid: 'Do not change your dose on your own and do not take two doses together if missed.',
    whenToCallDoctor: `Call a doctor if you notice rash, swelling, dizziness, or unusual pain. ${MANDATORY_DOCTOR_LINE.en}`,
  };
}

/**
 * Generates 6th-grade plain-language explanations for a list of medicines in the target language.
 */
export async function generatePlainExplanations(
  medicines: Array<{
    id?: number;
    name: string;
    activeIngredient?: string;
    strength: string;
    doseAmount: string;
    slots: DoseSlot[];
    foodTiming: FoodTiming;
    durationDays: number;
    specialInstructions: string;
  }>,
  language: SupportedLanguage,
  demoMode: boolean
): Promise<MedicineExplanation[]> {
  // Fast check: in Demo Mode, use sample translations or fallback immediately
  if (demoMode) {
    return medicines.map((m) => buildFallbackExplanation(m, language));
  }

  const ai = getGeminiClient();
  if (!ai) {
    return medicines.map((m) => buildFallbackExplanation(m, language));
  }

  try {
    const promptPayload = medicines.map((m, idx) => ({
      index: idx,
      name: m.name,
      strength: m.strength,
      doseAmount: m.doseAmount,
      timesOfDay: m.slots.join(', '),
      foodTiming: m.foodTiming.replace('_', ' '),
      durationDays: m.durationDays,
      specialInstructions: m.specialInstructions,
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Target language: ${LANGUAGE_NAMES[language]}.\nMandatory closing sentence for whenToCallDoctor: "${MANDATORY_DOCTOR_LINE[language]}"\n\nMedicines:\n${JSON.stringify(promptPayload, null, 2)}`,
      config: {
        systemInstruction:
          'You are MediSathi, a calm health literacy assistant for patients in India. Write 6th-grade plain-language explanations in the requested target language. Keep sentences short and clear for speaking aloud. Never diagnose, never advise stopping or starting medicines, and never change doses. Always end whenToCallDoctor with the exact mandatory doctor/pharmacist confirmation sentence provided.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              usedFor: { type: Type.STRING },
              howAndWhen: { type: Type.STRING },
              whatToAvoid: { type: Type.STRING },
              whenToCallDoctor: { type: Type.STRING },
            },
            required: ['usedFor', 'howAndWhen', 'whatToAvoid', 'whenToCallDoctor'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as MedicineExplanation[];
    if (!Array.isArray(parsed) || parsed.length !== medicines.length) {
      throw new Error('Explanation array length mismatch');
    }

    const requiredEnding = MANDATORY_DOCTOR_LINE[language];
    return parsed.map((item) => ({
      usedFor: item.usedFor,
      howAndWhen: item.howAndWhen,
      whatToAvoid: item.whatToAvoid,
      whenToCallDoctor: item.whenToCallDoctor.includes(requiredEnding)
        ? item.whenToCallDoctor
        : `${item.whenToCallDoctor.trim()} ${requiredEnding}`,
    }));
  } catch (err) {
    console.warn('Gemini explanation generation failed, using fallback:', err);
    return medicines.map((m) => buildFallbackExplanation(m, language));
  }
}

/**
 * Generates WAV speech audio using `gemini-3.8-flash-lite-tts`.
 * Returns null if API key is missing or call fails, allowing browser Web Speech API fallback.
 */
export async function synthesizeSpeechWav(
  text: string,
  language: SupportedLanguage
): Promise<{ audioBase64: string; mimeType: 'audio/wav' } | null> {
  const ai = getGeminiClient();
  if (!ai || !text.trim()) return null;

  const langHint: Record<SupportedLanguage, string> = {
    en: 'Clear, warm Indian English medical helper voice, gentle pace',
    hi: 'Clear, warm Hindi voice, gentle slow pace for patients',
    as: 'Clear, warm Assamese voice, gentle slow pace for patients',
    bn: 'Clear, warm Bengali voice, gentle slow pace for patients',
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 1200),
              speechMetadata: {
                style: langHint[language],
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const audioBase64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) return null;

    return { audioBase64, mimeType: 'audio/wav' };
  } catch (err) {
    console.warn('Gemini TTS failed, client will use Web Speech fallback:', err);
    return null;
  }
}

/**
 * Transcribes a short voice question audio clip using `gemini-3.5-transcribe`.
 */
export async function transcribeQuestionAudio(
  audioBase64: string,
  mimeType: string,
  language: SupportedLanguage
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Voice transcription requires Gemini API configuration.');
  }
  const cleaned = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: cleaned,
          },
        },
        {
          text: `Transcribe this patient's short question about their medicine. The spoken language is likely ${LANGUAGE_NAMES[language]}. Return only the transcribed question text.`,
        },
      ],
    },
  });
  return (response.text ?? '').trim();
}

/**
 * Answers a patient's question strictly scoped to their verified prescription context.
 */
export async function answerPrescriptionQuestion(options: {
  question: string;
  language: SupportedLanguage;
  prescriptionContext: string;
  demoMode: boolean;
}): Promise<string> {
  const ending = MANDATORY_DOCTOR_LINE[options.language];
  const ai = getGeminiClient();

  if (options.demoMode || !ai) {
    if (options.language === 'hi') {
      return `आपकी मौजूदा पर्ची के अनुसार, हर दवा तय समय और भोजन निर्देश के साथ ही लें। मैं नई दवा या खुराक बदलने की सलाह नहीं दे सकता। ${ending}`;
    }
    if (options.language === 'as') {
      return `আপোনাৰ বৰ্তমানৰ প্ৰেছক্ৰিপচন অনুসৰি দৰৱবোৰ নিৰ্দিষ্ট সময় আৰু আহাৰৰ নিয়ম মতে খাওক। মই পালি সলনি কৰাৰ পৰামৰ্শ দিব নোৱাৰো। ${ending}`;
    }
    if (options.language === 'bn') {
      return `আপনার বর্তমান প্রেসক্রিপশন অনুযায়ী ওষুধগুলো নির্দিষ্ট সময় ও খাবারের নিয়ম মেনে খাবেন। আমি ডোজ বদলানোর পরামর্শ দিতে পারি না। ${ending}`;
    }
    return `Based on your active prescription, please follow the confirmed timing and food instructions shown on your schedule. I cannot diagnose or suggest changing any dose. ${ending}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Patient Language: ${LANGUAGE_NAMES[options.language]}\nMandatory closing sentence: "${ending}"\n\nPatient's Verified Prescription Context:\n${options.prescriptionContext}\n\nPatient Question: "${options.question}"`,
      config: {
        systemInstruction:
          'You are MediSathi, a safety-bounded medicine guide. Answer ONLY using the medicines and instructions in the provided prescription context. Keep your answer to 2-3 short, simple 6th-grade sentences suitable for reading aloud. Refuse to diagnose, recommend starting/stopping any medicine, or changing doses. Always end with the exact mandatory closing sentence.',
      },
    });

    const text = (response.text ?? '').trim();
    if (!text) return ending;
    return text.includes(ending) ? text : `${text} ${ending}`;
  } catch (err) {
    console.warn('Gemini Q&A failed:', err);
    return `I could not connect right now to answer that question. ${ending}`;
  }
}
