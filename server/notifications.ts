import { db, getCaregiverProfile, getPatientProfile, todayDateString } from './db.js';
import type { DoseSlot } from './types.js';

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_SMS_FROM)
  );
}

async function sendTwilioAlert(
  toPhone: string,
  body: string
): Promise<'whatsapp' | 'sms' | 'in_app'> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  const smsFrom = process.env.TWILIO_SMS_FROM;

  if (!sid || !token || (!waFrom && !smsFrom) || !toPhone) {
    return 'in_app';
  }

  const useWhatsApp = Boolean(waFrom);
  const from = useWhatsApp ? waFrom! : smsFrom!;
  const cleanPhone = toPhone.replace(/\s+/g, '');
  const to = useWhatsApp
    ? cleanPhone.startsWith('whatsapp:')
      ? cleanPhone
      : `whatsapp:${cleanPhone}`
    : cleanPhone;

  try {
    const params = new URLSearchParams({ From: from, To: to, Body: body });
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (resp.ok) {
      return useWhatsApp ? 'whatsapp' : 'sms';
    }
    console.warn('Twilio alert fallback to in-app feed:', resp.status);
    return 'in_app';
  } catch (err) {
    console.warn('Twilio network error, falling back to in-app feed:', err);
    return 'in_app';
  }
}

/**
 * Checks all today's pending doses that are more than 60 minutes past their scheduled time
 * (or immediately triggers the next pending dose when forceDemo=true for live demos).
 */
export async function checkAndDispatchMissedDoseAlerts(
  patientId = 1,
  forceDemo = false
): Promise<{ triggeredCount: number; message: string | null }> {
  const today = todayDateString();
  const patient = getPatientProfile(patientId);
  const caregiver = getCaregiverProfile(patientId);

  const pendingRows = db
    .prepare(
      `SELECT
        l.id AS log_id,
        d.id AS dose_id,
        d.slot,
        d.scheduled_time,
        m.name AS medicine_name,
        m.strength
      FROM adherence_logs l
      JOIN doses d ON d.id = l.dose_id
      JOIN medicines m ON m.id = d.medicine_id
      WHERE l.user_id = ?
        AND l.scheduled_for = ?
        AND l.status = 'pending'
        AND l.caregiver_alerted = 0
        AND d.is_active = 1
      ORDER BY d.id ASC`
    )
    .all(patientId, today) as Array<{
    log_id: number;
    dose_id: number;
    slot: DoseSlot;
    scheduled_time: string;
    medicine_name: string;
    strength: string;
  }>;

  if (pendingRows.length === 0) {
    if (!forceDemo) {
      return { triggeredCount: 0, message: null };
    }
    // If all today's doses are already acted on during a demo fast-forward, pick the first active dose
    const fallbackDose = db
      .prepare(
        `SELECT d.id AS dose_id, d.slot, d.scheduled_time, m.name AS medicine_name, m.strength
         FROM doses d
         JOIN medicines m ON m.id = d.medicine_id
         WHERE d.user_id = ? AND d.is_active = 1
         ORDER BY d.id ASC LIMIT 1`
      )
      .get(patientId) as
      | { dose_id: number; slot: DoseSlot; scheduled_time: string; medicine_name: string; strength: string }
      | undefined;

    if (!fallbackDose) {
      return { triggeredCount: 0, message: 'No active doses found to simulate.' };
    }

    const alertText = `MediSathi Caregiver Alert: ${patient.name} has not marked their ${fallbackDose.slot} dose of ${fallbackDose.medicine_name} ${fallbackDose.strength} (${fallbackDose.scheduled_time}) as taken within 60 minutes. Please check in gently.`;
    const channel = await sendTwilioAlert(caregiver.phone, alertText);

    db.prepare(
      `INSERT INTO adherence_logs (dose_id, user_id, scheduled_for, status, caregiver_alerted, alert_channel, alert_message)
       VALUES (?, ?, ?, 'missed', 1, ?, ?)
       ON CONFLICT(dose_id, scheduled_for)
       DO UPDATE SET status = 'missed', caregiver_alerted = 1, alert_channel = excluded.alert_channel, alert_message = excluded.alert_message`
    ).run(fallbackDose.dose_id, patientId, today, channel, alertText);

    return { triggeredCount: 1, message: alertText };
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const targets = forceDemo
    ? [pendingRows[0]]
    : pendingRows.filter((row) => {
        const [hh, mm] = row.scheduled_time.split(':').map(Number);
        const schedMinutes = (hh || 8) * 60 + (mm || 0);
        return nowMinutes - schedMinutes >= 60;
      });

  let triggeredCount = 0;
  let lastMessage: string | null = null;

  for (const row of targets) {
    const alertText = `MediSathi Alert: ${patient.name} has not marked their ${row.slot} dose of ${row.medicine_name} ${row.strength} (${row.scheduled_time}) taken within 60 minutes.`;
    const channel = await sendTwilioAlert(caregiver.phone, alertText);

    db.prepare(
      `UPDATE adherence_logs
       SET status = 'missed', caregiver_alerted = 1, alert_channel = ?, alert_message = ?
       WHERE id = ?`
    ).run(channel, alertText, row.log_id);

    triggeredCount += 1;
    lastMessage = alertText;
  }

  return { triggeredCount, message: lastMessage };
}

/**
 * Sends a predefined urgent One-Touch Emergency message to the primary caregiver
 * via Twilio WhatsApp/SMS if configured, and records it in emergency_alerts.
 */
export async function dispatchEmergencyCaregiverAlert(
  patientId = 1
): Promise<{ channel: 'whatsapp' | 'sms' | 'in_app'; message: string; caregiverPhone: string; caregiverName: string }> {
  const patient = getPatientProfile(patientId);
  const caregiver = getCaregiverProfile(patientId);

  const alertText = `URGENT SOS from MediSathi: ${patient.name} tapped One-Touch Emergency and needs immediate help. Please call ${patient.name} (${patient.phone}) right away.`;
  const channel = await sendTwilioAlert(caregiver.phone, alertText);

  db.prepare(
    `INSERT INTO emergency_alerts (user_id, channel, message)
     VALUES (?, ?, ?)`
  ).run(patientId, channel, alertText);

  return {
    channel,
    message: alertText,
    caregiverPhone: caregiver.phone,
    caregiverName: caregiver.name,
  };
}
