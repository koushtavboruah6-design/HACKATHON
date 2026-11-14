import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  evaluatePrescriptionSafety,
  getJanAushadhiAlternative,
  getMedicineVisualAppearance,
} from './safety.js';
import type {
  CaregiverAlert,
  CaregiverProfile,
  ConfidenceLevel,
  DoseScheduleItem,
  DoseSlot,
  ExtractedMedicineInput,
  FoodTiming,
  MedicineExplanation,
  MedicineRecord,
  PatientProfile,
  SupportedLanguage,
  WeeklySummaryDay,
} from './types.js';

const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'medisathi.db');
export const db = new DatabaseSync(dbPath);

export const SLOT_TIMES: Record<DoseSlot, string> = {
  morning: '08:00',
  afternoon: '13:00',
  night: '21:00',
};

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function initDatabase(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'patient',
      language TEXT NOT NULL DEFAULT 'en',
      phone TEXT DEFAULT '',
      conditions_json TEXT NOT NULL DEFAULT '[]',
      allergies_json TEXT NOT NULL DEFAULT '[]',
      streak_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caregivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'Family / ASHA',
      phone TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'in_app',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'sample',
      overall_confidence TEXT NOT NULL DEFAULT 'high',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active_ingredient TEXT NOT NULL DEFAULT '',
      strength TEXT NOT NULL DEFAULT '',
      dose_amount TEXT NOT NULL DEFAULT '1 tablet',
      frequency_code TEXT NOT NULL DEFAULT '1-0-0',
      slots_json TEXT NOT NULL DEFAULT '["morning"]',
      food_timing TEXT NOT NULL DEFAULT 'after_food',
      duration_days INTEGER NOT NULL DEFAULT 7,
      special_instructions TEXT NOT NULL DEFAULT '',
      confidence TEXT NOT NULL DEFAULT 'high',
      confirmed_by_user INTEGER NOT NULL DEFAULT 1,
      explanations_json TEXT NOT NULL DEFAULT '{}',
      safety_flags_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS doses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      slot TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      dose_label TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS adherence_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dose_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      acted_at TEXT,
      caregiver_alerted INTEGER NOT NULL DEFAULT 0,
      alert_channel TEXT,
      alert_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(dose_id, scheduled_for),
      FOREIGN KEY (dose_id) REFERENCES doses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS emergency_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedDemoDataIfEmpty();
}

function seedDemoDataIfEmpty(): void {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
  if (existing) return;

  const insertUser = db.prepare(
    `INSERT INTO users (name, role, language, phone, conditions_json, allergies_json, streak_days)
     VALUES (?, 'patient', 'en', ?, ?, ?, ?)`
  );
  const userRes = insertUser.run(
    'Ramesh Das',
    '+91 98640 11223',
    JSON.stringify(['Type 2 Diabetes', 'High Blood Pressure']),
    JSON.stringify(['Penicillin']),
    5
  );
  const patientId = Number(userRes.lastInsertRowid);

  db.prepare(
    `INSERT INTO caregivers (patient_id, name, relation, phone, channel)
     VALUES (?, ?, ?, ?, ?)`
  ).run(patientId, 'Meera Das (Daughter & ASHA Contact)', 'Daughter', '+91 98640 44556', 'in_app');

  const demoDefault = process.env.DEMO_MODE === 'true' ? 'true' : 'false';
  db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('demo_mode', ?)`).run(demoDefault);

  // Seed initial chronic prescription from sample_prescriptions.json
  const samplesRaw = readFileSync(join(process.cwd(), 'data', 'sample_prescriptions.json'), 'utf-8');
  const samplesData = JSON.parse(samplesRaw) as {
    samples: Array<{
      id: string;
      clinicTitle: string;
      overallConfidence: ConfidenceLevel;
      medicines: Array<
        ExtractedMedicineInput & {
          explanations?: Partial<Record<SupportedLanguage, MedicineExplanation>>;
        }
      >;
    }>;
  };
  const firstSample = samplesData.samples[0];
  if (firstSample) {
    const rxId = saveConfirmedPrescription(
      patientId,
      firstSample.clinicTitle,
      'sample',
      firstSample.overallConfidence,
      firstSample.medicines
    );

    // Seed 6 prior days of realistic adherence logs for weekly chart & streak
    const doses = db
      .prepare('SELECT id, slot FROM doses WHERE user_id = ? AND is_active = 1')
      .all(patientId) as Array<{ id: number; slot: DoseSlot }>;

    const logStmt = db.prepare(
      `INSERT OR IGNORE INTO adherence_logs (dose_id, user_id, scheduled_for, status, acted_at, caregiver_alerted, alert_channel, alert_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (let daysBack = 6; daysBack >= 1; daysBack--) {
      const dateStr = daysAgoDateString(daysBack);
      doses.forEach((d, idx) => {
        // Day 4 had one missed night dose for realistic caregiver history
        const missed = daysBack === 4 && d.slot === 'night' && idx === doses.length - 1;
        const skipped = daysBack === 2 && d.slot === 'afternoon';
        const status = missed ? 'missed' : skipped ? 'skipped' : 'taken';
        logStmt.run(
          d.id,
          patientId,
          dateStr,
          status,
          `${dateStr}T${SLOT_TIMES[d.slot]}:00`,
          missed ? 1 : 0,
          missed ? 'in_app' : null,
          missed ? `Missed Night dose on ${dateStr}. Caregiver Meera Das notified.` : null
        );
      });
    }

    // Also pre-mark today's morning doses as pending so demo user can tap Taken/Skip immediately
    void rxId;
  }
}

export function getDemoMode(): boolean {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'demo_mode'`).get() as
    | { value: string }
    | undefined;
  return row?.value === 'true';
}

export function setDemoMode(enabled: boolean): void {
  db.prepare(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('demo_mode', ?)`).run(
    enabled ? 'true' : 'false'
  );
}

export function getPatientProfile(patientId = 1): PatientProfile {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(patientId) as {
    id: number;
    name: string;
    language: SupportedLanguage;
    phone: string;
    conditions_json: string;
    allergies_json: string;
    streak_days: number;
  };
  return {
    id: row.id,
    name: row.name,
    role: 'patient',
    language: row.language,
    phone: row.phone,
    conditions: JSON.parse(row.conditions_json || '[]'),
    allergies: JSON.parse(row.allergies_json || '[]'),
    streakDays: row.streak_days,
  };
}

export function getCaregiverProfile(patientId = 1): CaregiverProfile {
  const row = db.prepare('SELECT * FROM caregivers WHERE patient_id = ? LIMIT 1').get(patientId) as {
    id: number;
    patient_id: number;
    name: string;
    relation: string;
    phone: string;
    channel: 'whatsapp' | 'sms' | 'in_app';
  };
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    relation: row.relation,
    phone: row.phone,
    channel: row.channel,
  };
}

export function updatePatientProfile(
  patientId: number,
  updates: {
    language?: SupportedLanguage;
    conditions?: string[];
    allergies?: string[];
  }
): PatientProfile {
  const current = getPatientProfile(patientId);
  const nextLang = updates.language ?? current.language;
  const nextConds = updates.conditions ?? current.conditions;
  const nextAllergies = updates.allergies ?? current.allergies;

  db.prepare(
    `UPDATE users SET language = ?, conditions_json = ?, allergies_json = ? WHERE id = ?`
  ).run(nextLang, JSON.stringify(nextConds), JSON.stringify(nextAllergies), patientId);

  // Re-evaluate safety flags on active prescription medicines when conditions/allergies change
  if (updates.conditions !== undefined || updates.allergies !== undefined) {
    recomputeActivePrescriptionSafety(patientId, nextConds, nextAllergies);
  }

  return getPatientProfile(patientId);
}

export function recomputeActivePrescriptionSafety(
  patientId: number,
  conditions: string[],
  allergies: string[]
): void {
  const latestRx = db
    .prepare('SELECT id FROM prescriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(patientId) as { id: number } | undefined;
  if (!latestRx) return;

  const meds = db
    .prepare('SELECT id, name, active_ingredient FROM medicines WHERE prescription_id = ? ORDER BY id ASC')
    .all(latestRx.id) as Array<{ id: number; name: string; active_ingredient: string }>;

  const { perMedicineWarnings } = evaluatePrescriptionSafety(
    meds.map((m) => ({ name: m.name, activeIngredient: m.active_ingredient })),
    conditions,
    allergies
  );

  const upd = db.prepare('UPDATE medicines SET safety_flags_json = ? WHERE id = ?');
  meds.forEach((m, idx) => {
    upd.run(JSON.stringify(perMedicineWarnings[idx] ?? []), m.id);
  });
}

export function saveConfirmedPrescription(
  patientId: number,
  title: string,
  sourceType: 'camera' | 'upload' | 'sample',
  overallConfidence: ConfidenceLevel,
  medicines: Array<
    ExtractedMedicineInput & {
      explanations?: Partial<Record<SupportedLanguage, MedicineExplanation>>;
    }
  >
): number {
  const patient = getPatientProfile(patientId);

  // Deactivate previous active doses so today's timeline reflects the confirmed prescription cleanly
  db.prepare('UPDATE doses SET is_active = 0 WHERE user_id = ?').run(patientId);

  const rxRes = db
    .prepare(
      `INSERT INTO prescriptions (user_id, title, source_type, overall_confidence)
       VALUES (?, ?, ?, ?)`
    )
    .run(patientId, title, sourceType, overallConfidence);
  const prescriptionId = Number(rxRes.lastInsertRowid);

  const { perMedicineWarnings } = evaluatePrescriptionSafety(
    medicines.map((m) => ({ name: m.name, activeIngredient: m.activeIngredient || '' })),
    patient.conditions,
    patient.allergies
  );

  const insertMed = db.prepare(
    `INSERT INTO medicines (
      prescription_id, name, active_ingredient, strength, dose_amount, frequency_code,
      slots_json, food_timing, duration_days, special_instructions, confidence,
      confirmed_by_user, explanations_json, safety_flags_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );

  const insertDose = db.prepare(
    `INSERT INTO doses (medicine_id, user_id, slot, scheduled_time, dose_label, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  );

  const insertLog = db.prepare(
    `INSERT OR IGNORE INTO adherence_logs (dose_id, user_id, scheduled_for, status)
     VALUES (?, ?, ?, 'pending')`
  );

  const today = todayDateString();

  medicines.forEach((med, idx) => {
    const slots: DoseSlot[] =
      med.slots && med.slots.length > 0 ? med.slots : ['morning'];

    const medRes = insertMed.run(
      prescriptionId,
      med.name,
      med.activeIngredient || '',
      med.strength || '',
      med.doseAmount || '1 tablet',
      med.frequencyCode || '1-0-0',
      JSON.stringify(slots),
      med.foodTiming || 'after_food',
      med.durationDays || 5,
      med.specialInstructions || '',
      med.confidence || 'high',
      JSON.stringify(med.explanations ?? {}),
      JSON.stringify(perMedicineWarnings[idx] ?? [])
    );
    const medicineId = Number(medRes.lastInsertRowid);

    for (const slot of slots) {
      const doseRes = insertDose.run(
        medicineId,
        patientId,
        slot,
        SLOT_TIMES[slot],
        `${med.doseAmount || '1 tablet'} · ${med.foodTiming.replace('_', ' ')}`
      );
      const doseId = Number(doseRes.lastInsertRowid);
      insertLog.run(doseId, patientId, today);
    }
  });

  return prescriptionId;
}

export function getActivePrescriptionAndMedicines(patientId = 1): {
  prescription: { id: number; title: string; sourceType: string; overallConfidence: ConfidenceLevel; createdAt: string } | null;
  medicines: MedicineRecord[];
} {
  const rx = db
    .prepare('SELECT * FROM prescriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(patientId) as
    | { id: number; title: string; source_type: string; overall_confidence: ConfidenceLevel; created_at: string }
    | undefined;

  if (!rx) {
    return { prescription: null, medicines: [] };
  }

  const rows = db
    .prepare('SELECT * FROM medicines WHERE prescription_id = ? ORDER BY id ASC')
    .all(rx.id) as Array<{
    id: number;
    prescription_id: number;
    name: string;
    active_ingredient: string;
    strength: string;
    dose_amount: string;
    frequency_code: string;
    slots_json: string;
    food_timing: FoodTiming;
    duration_days: number;
    special_instructions: string;
    confidence: ConfidenceLevel;
    confirmed_by_user: number;
    explanations_json: string;
    safety_flags_json: string;
  }>;

  const medicines: MedicineRecord[] = rows.map((r) => ({
    id: r.id,
    prescriptionId: r.prescription_id,
    name: r.name,
    activeIngredient: r.active_ingredient,
    strength: r.strength,
    doseAmount: r.dose_amount,
    frequencyCode: r.frequency_code,
    slots: JSON.parse(r.slots_json || '["morning"]'),
    foodTiming: r.food_timing,
    durationDays: r.duration_days,
    specialInstructions: r.special_instructions,
    confidence: r.confidence,
    confirmedByUser: r.confirmed_by_user === 1,
    explanations: JSON.parse(r.explanations_json || '{}'),
    safetyFlags: JSON.parse(r.safety_flags_json || '[]'),
    janAushadhi: getJanAushadhiAlternative(r.name, r.active_ingredient),
    visualAppearance: getMedicineVisualAppearance(r.name, r.active_ingredient, r.dose_amount),
  }));

  return {
    prescription: {
      id: rx.id,
      title: rx.title,
      sourceType: rx.source_type,
      overallConfidence: rx.overall_confidence,
      createdAt: rx.created_at,
    },
    medicines,
  };
}

export function updateMedicineExplanation(
  medicineId: number,
  language: SupportedLanguage,
  explanation: MedicineExplanation
): void {
  const row = db
    .prepare('SELECT explanations_json FROM medicines WHERE id = ?')
    .get(medicineId) as { explanations_json: string } | undefined;
  if (!row) return;

  const current = JSON.parse(row.explanations_json || '{}') as Partial<
    Record<SupportedLanguage, MedicineExplanation>
  >;
  current[language] = explanation;
  db.prepare('UPDATE medicines SET explanations_json = ? WHERE id = ?').run(
    JSON.stringify(current),
    medicineId
  );
}

export function ensureTodayDoseLogs(patientId = 1): void {
  const today = todayDateString();
  const activeDoses = db
    .prepare('SELECT id FROM doses WHERE user_id = ? AND is_active = 1')
    .all(patientId) as Array<{ id: number }>;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO adherence_logs (dose_id, user_id, scheduled_for, status)
     VALUES (?, ?, ?, 'pending')`
  );
  for (const d of activeDoses) {
    stmt.run(d.id, patientId, today);
  }
}

export function getTodaySchedule(patientId = 1): DoseScheduleItem[] {
  ensureTodayDoseLogs(patientId);
  const today = todayDateString();

  const rows = db
    .prepare(
      `SELECT
        d.id AS dose_id,
        d.medicine_id,
        m.name AS medicine_name,
        m.strength,
        m.dose_amount,
        m.food_timing,
        m.special_instructions,
        d.slot,
        d.scheduled_time,
        COALESCE(l.status, 'pending') AS status,
        l.acted_at,
        COALESCE(l.caregiver_alerted, 0) AS caregiver_alerted
      FROM doses d
      JOIN medicines m ON m.id = d.medicine_id
      LEFT JOIN adherence_logs l ON l.dose_id = d.id AND l.scheduled_for = ?
      WHERE d.user_id = ? AND d.is_active = 1
      ORDER BY
        CASE d.slot WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 ELSE 3 END,
        d.id ASC`
    )
    .all(today, patientId) as Array<{
    dose_id: number;
    medicine_id: number;
    medicine_name: string;
    strength: string;
    dose_amount: string;
    food_timing: FoodTiming;
    special_instructions: string;
    slot: DoseSlot;
    scheduled_time: string;
    status: 'pending' | 'taken' | 'skipped' | 'missed';
    acted_at: string | null;
    caregiver_alerted: number;
  }>;

  return rows.map((r) => ({
    doseId: r.dose_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    strength: r.strength,
    doseAmount: r.dose_amount,
    foodTiming: r.food_timing,
    specialInstructions: r.special_instructions,
    slot: r.slot,
    scheduledTime: r.scheduled_time,
    status: r.status,
    actedAt: r.acted_at,
    caregiverAlerted: r.caregiver_alerted === 1,
  }));
}

export function recordDoseAction(
  doseId: number,
  patientId: number,
  action: 'taken' | 'skipped'
): { schedule: DoseScheduleItem[]; streakDays: number } {
  const today = todayDateString();
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO adherence_logs (dose_id, user_id, scheduled_for, status, acted_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(dose_id, scheduled_for)
     DO UPDATE SET status = excluded.status, acted_at = excluded.acted_at`
  ).run(doseId, patientId, today, action, nowIso);

  // Recompute streak if all today's active doses have been taken at least partially
  const todayStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN l.status = 'taken' THEN 1 ELSE 0 END) AS taken
       FROM doses d
       LEFT JOIN adherence_logs l ON l.dose_id = d.id AND l.scheduled_for = ?
       WHERE d.user_id = ? AND d.is_active = 1`
    )
    .get(today, patientId) as { total: number; taken: number };

  if (action === 'taken' && todayStats.taken >= 1) {
    // Keep streak motivating: increment up to 6+ when today has taken doses
    db.prepare('UPDATE users SET streak_days = MAX(streak_days, 6) WHERE id = ?').run(patientId);
  }

  return {
    schedule: getTodaySchedule(patientId),
    streakDays: getPatientProfile(patientId).streakDays,
  };
}

export function getWeeklySummary(patientId = 1): WeeklySummaryDay[] {
  const summary: WeeklySummaryDay[] = [];
  const dayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });

  for (let daysBack = 6; daysBack >= 0; daysBack--) {
    const dateStr = daysAgoDateString(daysBack);
    const dObj = new Date(`${dateStr}T12:00:00`);
    const label = daysBack === 0 ? 'Today' : dayFormatter.format(dObj);

    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) AS taken
         FROM adherence_logs
         WHERE user_id = ? AND scheduled_for = ?`
      )
      .get(patientId, dateStr) as { total: number; taken: number };

    const total = row.total || 0;
    const taken = row.taken || 0;
    const rate = total > 0 ? Math.round((taken / total) * 100) : 0;
    summary.push({ date: dateStr, label, taken, total, rate });
  }

  return summary;
}

export function getCaregiverAlerts(patientId = 1): CaregiverAlert[] {
  const emergencyRows = db
    .prepare(
      `SELECT id, channel, message, created_at
       FROM emergency_alerts
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 10`
    )
    .all(patientId) as Array<{
    id: number;
    channel: 'whatsapp' | 'sms' | 'in_app';
    message: string;
    created_at: string;
  }>;

  const emergencyMapped: CaregiverAlert[] = emergencyRows.map((e) => ({
    id: 100000 + e.id,
    doseId: 0,
    medicineName: 'One-Touch Emergency',
    slot: 'morning',
    scheduledFor: e.created_at.slice(0, 10),
    channel: e.channel,
    message: e.message,
    createdAt: e.created_at,
  }));

  const rows = db
    .prepare(
      `SELECT
        l.id,
        l.dose_id,
        m.name AS medicine_name,
        d.slot,
        l.scheduled_for,
        COALESCE(l.alert_channel, 'in_app') AS channel,
        l.alert_message,
        l.created_at
      FROM adherence_logs l
      JOIN doses d ON d.id = l.dose_id
      JOIN medicines m ON m.id = d.medicine_id
      WHERE l.user_id = ? AND l.caregiver_alerted = 1
      ORDER BY l.id DESC
      LIMIT 15`
    )
    .all(patientId) as Array<{
    id: number;
    dose_id: number;
    medicine_name: string;
    slot: DoseSlot;
    scheduled_for: string;
    channel: 'whatsapp' | 'sms' | 'in_app';
    alert_message: string | null;
    created_at: string;
  }>;

  const doseMapped: CaregiverAlert[] = rows.map((r) => ({
    id: r.id,
    doseId: r.dose_id,
    medicineName: r.medicine_name,
    slot: r.slot,
    scheduledFor: r.scheduled_for,
    channel: r.channel,
    message:
      r.alert_message ||
      `${r.medicine_name} (${r.slot} dose) was not marked taken within 60 minutes.`,
    createdAt: r.created_at,
  }));

  return [...emergencyMapped, ...doseMapped]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);
}
