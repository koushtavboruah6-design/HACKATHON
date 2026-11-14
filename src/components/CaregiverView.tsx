import React, { useState } from 'react';
import {
  BellRing,
  FastForward,
  HeartHandshake,
  Phone,
  Plus,
  Volume2,
  X,
  Square,
} from 'lucide-react';
import type {
  CaregiverAlert,
  CaregiverProfile,
  DoseScheduleItem,
  PatientProfile,
  SupportedLanguage,
  WeeklySummaryDay,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { audioManager } from '../utils/audioPlayer';

interface CaregiverViewProps {
  language: SupportedLanguage;
  patient: PatientProfile;
  caregiver: CaregiverProfile;
  schedule: DoseScheduleItem[];
  weeklySummary: WeeklySummaryDay[];
  alerts: CaregiverAlert[];
  demoMode: boolean;
  twilioConfigured: boolean;
  playingKey: string | null;
  onToggleDemoMode: (enabled: boolean) => void;
  onFastForwardMissed: () => Promise<string | null>;
  onUpdateConditionsAllergies: (conditions: string[], allergies: string[]) => void;
}

export const CaregiverView: React.FC<CaregiverViewProps> = ({
  language,
  patient,
  caregiver,
  schedule,
  weeklySummary,
  alerts,
  demoMode,
  twilioConfigured,
  playingKey,
  onToggleDemoMode,
  onFastForwardMissed,
  onUpdateConditionsAllergies,
}) => {
  const t = TRANSLATIONS[language];
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const takenCount = schedule.filter((d) => d.status === 'taken').length;
  const totalCount = schedule.length;
  const todayRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const handleFastForward = async () => {
    setSimLoading(true);
    setSimFeedback(null);
    const msg = await onFastForwardMissed();
    setSimFeedback(msg);
    setSimLoading(false);
  };

  const handleSpeakSummary = () => {
    const summary = `${t.caregiverTitle}. ${patient.name}: ${todayRate}% ${t.todayAdherence}. ${takenCount} of ${totalCount} doses taken. ${alerts.length} missed dose alerts recorded. ${t.mandatoryDoctorLine}`;
    audioManager.playText('caregiver-summary', summary, language);
  };

  const addCondition = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (!patient.conditions.includes(trimmed)) {
      onUpdateConditionsAllergies([...patient.conditions, trimmed], patient.allergies);
    }
    setNewCondition('');
  };

  const addAllergy = () => {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (!patient.allergies.includes(trimmed)) {
      onUpdateConditionsAllergies(patient.conditions, [...patient.allergies, trimmed]);
    }
    setNewAllergy('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Today's Adherence Summary */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Patient: {patient.name} · Caregiver: {caregiver.name}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5">
              {t.caregiverTitle}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleSpeakSummary}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 self-start sm:self-auto"
          >
            {playingKey === 'caregiver-summary' ? (
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{playingKey === 'caregiver-summary' ? t.stopAudio : t.listenPage}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-slate-500">{t.todayAdherence}</p>
            <p className="text-3xl font-bold text-teal-800 mt-1 tabular-nums">{todayRate}%</p>
            <p className="text-sm text-slate-600 mt-0.5 tabular-nums">
              {takenCount} of {totalCount} doses taken today
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-slate-500">{t.streakLabel}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {patient.streakDays} {t.days}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">Active daily follow-up</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-slate-500">Alert Contact</p>
            <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <span>{caregiver.name}</span>
            </p>
            <p className="text-sm text-slate-600 mt-0.5 flex items-center gap-1.5 tabular-nums">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{caregiver.phone}</span>
              <span aria-hidden="true">·</span>
              <span>{twilioConfigured ? 'Twilio Live' : 'In-App Feed'}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Adherence Chart */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{t.weeklySummary}</h2>
          <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4">
            {weeklySummary.map((day) => (
              <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                  {day.rate}%
                </span>
                <div className="w-full max-w-[36px] bg-slate-100 rounded-xl h-24 flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-xl transition-all ${
                      day.rate >= 80
                        ? 'bg-teal-600'
                        : day.rate >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                    style={{ height: `${Math.max(day.rate, 8)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700">{day.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Demo Mode & 60-Min Fast-Forward Trigger */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Demo & Escalation Controls</h2>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
            <div>
              <p className="text-sm font-bold text-slate-900">{t.demoModeLabel}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Uses cached sample extractions and fast offline explanations.
              </p>
            </div>
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => onToggleDemoMode(e.target.checked)}
              className="h-6 w-6 accent-teal-700 rounded cursor-pointer"
            />
          </label>

          <button
            type="button"
            disabled={simLoading}
            onClick={handleFastForward}
            className="w-full min-h-[52px] rounded-2xl bg-amber-600 px-5 py-3 text-base font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            <FastForward className="h-5 w-5" aria-hidden="true" />
            <span>{simLoading ? 'Sending Alert…' : t.fastForwardBtn}</span>
          </button>

          {simFeedback && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950">
              {simFeedback}
            </p>
          )}
        </section>
      </div>

      {/* Caregiver Missed-Dose Alert Feed */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <BellRing className="h-5 w-5 text-red-700" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">{t.alertFeedTitle}</h2>
        </div>

        {alerts.length === 0 ? (
          <p className="text-sm text-slate-600">No missed-dose alerts triggered yet.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-950">{alert.message}</p>
                  <p className="text-xs text-red-800 tabular-nums">
                    Channel: {alert.channel.toUpperCase()} · Date: {alert.scheduledFor}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Patient Conditions & Allergies Editor (Feeds Safety Checker) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Patient Conditions & Allergies
          </h2>
          <p className="text-sm text-slate-600">
            MediSathi automatically checks prescriptions against these entries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-800">Health Conditions</p>
            <div className="flex flex-wrap gap-2">
              {patient.conditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    onUpdateConditionsAllergies(
                      patient.conditions.filter((x) => x !== c),
                      patient.allergies
                    )
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-red-50 hover:border-red-200"
                >
                  <span>{c}</span>
                  <X className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="e.g. Stomach Ulcer, Asthma"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="button"
                onClick={addCondition}
                className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-800">Medicine Allergies</p>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    onUpdateConditionsAllergies(
                      patient.conditions,
                      patient.allergies.filter((x) => x !== a)
                    )
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
                >
                  <span>{a}</span>
                  <X className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                placeholder="e.g. Penicillin, Aspirin"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="button"
                onClick={addAllergy}
                className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
