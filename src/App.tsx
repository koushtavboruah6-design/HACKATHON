import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Camera,
  HeartHandshake,
  Pill,
  Volume2,
  Loader2,
  Languages,
  PhoneCall,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  AppTab,
  BootstrapPayload,
  DoseScheduleItem,
  DoseSlot,
  SupportedLanguage,
} from './types';
import { LANGUAGE_OPTIONS, TRANSLATIONS } from './i18n/translations';
import { audioManager } from './utils/audioPlayer';
import {
  isOnboarded,
  loadBootstrapCache,
  markOnboarded,
  saveBootstrapCache,
} from './utils/offlineCache';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LanguageOnboarding } from './components/LanguageOnboarding';
import { ScheduleView } from './components/ScheduleView';
import { ScanVerifyView } from './components/ScanVerifyView';
import { MedicinesView } from './components/MedicinesView';
import { CaregiverView } from './components/CaregiverView';

function getCurrentTimeSlot(): DoseSlot {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

export function App() {
  const [data, setData] = useState<BootstrapPayload | null>(() => loadBootstrapCache());
  const [loading, setLoading] = useState<boolean>(!loadBootstrapCache());
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !isOnboarded());
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [elderlyMode, setElderlyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('medisathi.elderly_mode.v1') === 'true';
    } catch {
      return false;
    }
  });
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [emergencySending, setEmergencySending] = useState(false);
  const [emergencyModal, setEmergencyModal] = useState<{
    message: string;
    channel: 'whatsapp' | 'sms' | 'in_app' | 'offline';
    caregiverName: string;
    caregiverPhone: string;
  } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  useEffect(() => {
    return audioManager.subscribe(setPlayingKey);
  }, []);

  const applyPayload = useCallback((payload: BootstrapPayload) => {
    setData(payload);
    saveBootstrapCache(payload);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const resp = await fetch('/api/patient/bootstrap');
      if (!resp.ok) throw new Error('Could not connect to MediSathi server.');
      const payload = (await resp.json()) as BootstrapPayload;
      applyPayload(payload);
      setError(null);
    } catch (err) {
      const cached = loadBootstrapCache();
      if (cached) {
        setData(cached);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load MediSathi.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  const language: SupportedLanguage = data?.patient.language ?? 'en';
  const t = TRANSLATIONS[language];

  // Identify the first pending dose matching the current time of day (or next pending dose)
  const activeReminderDose: DoseScheduleItem | null = useMemo(() => {
    if (!data?.schedule?.length) return null;
    const currentSlot = getCurrentTimeSlot();
    return (
      data.schedule.find((d) => d.status === 'pending' && d.slot === currentSlot) ||
      data.schedule.find((d) => d.status === 'pending') ||
      null
    );
  }, [data?.schedule]);

  // Periodically check due browser notification if granted
  useEffect(() => {
    if (notificationPermission !== 'granted' || !activeReminderDose) return;
    const tag = `medisathi-${activeReminderDose.doseId}-${new Date().toDateString()}`;
    if (sessionStorage.getItem(tag)) return;
    sessionStorage.setItem(tag, '1');
    try {
      new Notification(`MediSathi · ${t.reminderBannerTitle}`, {
        body: `${activeReminderDose.medicineName} ${activeReminderDose.strength} (${activeReminderDose.doseAmount})`,
        icon: '/pwa-192x192.png',
      });
    } catch {
      // Ignore notification construction restrictions
    }
  }, [activeReminderDose, notificationPermission, t.reminderBannerTitle]);

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
  };

  const handleLanguageChange = async (nextLang: SupportedLanguage) => {
    if (!data) return;
    setData({ ...data, patient: { ...data.patient, language: nextLang } });
    setTranslating(true);
    try {
      await fetch('/api/patient/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextLang }),
      });
      const resp = await fetch('/api/medicines/explain-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextLang }),
      });
      if (resp.ok) {
        const updated = (await resp.json()) as BootstrapPayload;
        applyPayload(updated);
      }
    } catch {
      // Keep local language selection if offline
    } finally {
      setTranslating(false);
    }
  };

  const handleDoseAction = async (doseId: number, action: 'taken' | 'skipped') => {
    if (!data) return;
    // Optimistic UI update for instant low-end phone responsiveness
    setData({
      ...data,
      schedule: data.schedule.map((d) =>
        d.doseId === doseId ? { ...d, status: action } : d
      ),
    });

    try {
      const resp = await fetch(`/api/doses/${doseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (resp.ok) {
        const updated = (await resp.json()) as BootstrapPayload;
        applyPayload(updated);
      }
    } catch {
      // Offline optimistic state remains visible
    }
  };

  const handleToggleDemoMode = async (enabled: boolean) => {
    if (!data) return;
    setData({ ...data, demoMode: enabled });
    try {
      await fetch('/api/demo/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      // ignore
    }
  };

  const handleFastForwardMissed = async (): Promise<string | null> => {
    try {
      const resp = await fetch('/api/demo/fast-forward', { method: 'POST' });
      if (!resp.ok) return 'Could not simulate missed dose.';
      const result = (await resp.json()) as {
        alertResult: { triggeredCount: number; message: string | null };
        bootstrap: BootstrapPayload;
      };
      applyPayload(result.bootstrap);
      return result.alertResult.message;
    } catch {
      return 'Network error while simulating missed dose.';
    }
  };

  const handleUpdateConditionsAllergies = async (
    conditions: string[],
    allergies: string[]
  ) => {
    try {
      const resp = await fetch('/api/patient/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions, allergies }),
      });
      if (resp.ok) {
        const updated = (await resp.json()) as BootstrapPayload;
        applyPayload(updated);
      }
    } catch {
      // ignore
    }
  };

  const handleEmergencyTrigger = async () => {
    if (!data || emergencySending) return;
    setEmergencySending(true);
    const localStrings = TRANSLATIONS[data.patient.language ?? 'en'];
    audioManager.playText(
      'emergency-trigger',
      `${localStrings.emergencyModalTitle}. ${localStrings.emergencyModalBody} ${localStrings.mandatoryDoctorLine}`,
      data.patient.language ?? 'en'
    );

    try {
      const resp = await fetch('/api/emergency/trigger', { method: 'POST' });
      if (resp.ok) {
        const result = (await resp.json()) as {
          emergency: {
            channel: 'whatsapp' | 'sms' | 'in_app';
            message: string;
            caregiverPhone: string;
            caregiverName: string;
          };
          bootstrap: BootstrapPayload;
        };
        applyPayload(result.bootstrap);
        setEmergencyModal(result.emergency);
      } else {
        setEmergencyModal({
          channel: 'offline',
          message: `URGENT SOS from MediSathi: ${data.patient.name} needs immediate help. Please call ${data.patient.phone} right away.`,
          caregiverName: data.caregiver.name,
          caregiverPhone: data.caregiver.phone,
        });
      }
    } catch {
      setEmergencyModal({
        channel: 'offline',
        message: `URGENT SOS from MediSathi: ${data.patient.name} needs immediate help. Please call ${data.patient.phone} right away.`,
        caregiverName: data.caregiver.name,
        caregiverPhone: data.caregiver.phone,
      });
    } finally {
      setEmergencySending(false);
    }
  };

  const handleRequestRefill = async (medicineNames: string[]) => {
    try {
      const resp = await fetch('/api/refill/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineNames }),
      });
      if (resp.ok) {
        const result = (await resp.json()) as { bootstrap: BootstrapPayload };
        applyPayload(result.bootstrap);
      }
    } catch {
      // ignore offline
    }
  };

  const handleMarkRefilled = async (medicineId: number) => {
    try {
      const resp = await fetch(`/api/medicines/${medicineId}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraDays: 10 }),
      });
      if (resp.ok) {
        const updated = (await resp.json()) as BootstrapPayload;
        applyPayload(updated);
      }
    } catch {
      // ignore offline
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="h-9 w-9 animate-spin text-teal-700" aria-hidden="true" />
        <p className="text-base font-semibold text-slate-700">Loading MediSathi…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center space-y-4">
          <p className="text-base font-bold text-red-900">{error}</p>
          <button
            type="button"
            onClick={fetchBootstrap}
            className="min-h-[48px] rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (showOnboarding) {
    return (
      <LanguageOnboarding
        selectedLanguage={language}
        playingKey={playingKey}
        onSelectLanguage={handleLanguageChange}
        onComplete={() => {
          markOnboarded();
          setShowOnboarding(false);
        }}
      />
    );
  }

  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
    { id: 'today', label: t.tabs.today, icon: <CalendarClock className="h-5 w-5" aria-hidden="true" /> },
    { id: 'scan', label: t.tabs.scan, icon: <Camera className="h-5 w-5" aria-hidden="true" /> },
    { id: 'medicines', label: t.tabs.medicines, icon: <Pill className="h-5 w-5" aria-hidden="true" /> },
    { id: 'caregiver', label: t.tabs.caregiver, icon: <HeartHandshake className="h-5 w-5" aria-hidden="true" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 pb-24 md:pb-12">
      {/* Compact 3-Zone Top Bar (<= 52px on mobile) */}
      <header className="sticky top-0 z-30 h-[52px] md:h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('today');
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-teal-800 whitespace-nowrap shrink-0"
          >
            MediSathi
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] px-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'border-teal-700 text-teal-800'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleEmergencyTrigger}
              disabled={emergencySending}
              aria-label={t.emergencyBtn}
              className={
                elderlyMode
                  ? 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-800 px-3.5 text-sm sm:text-base font-bold text-white shadow-xs whitespace-nowrap shrink-0 transition-colors disabled:opacity-60'
                  : 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 text-xs sm:text-sm font-bold text-rose-900 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60'
              }
            >
              {emergencySending ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{t.emergencyBtn}</span>
            </button>
            {!elderlyMode && (
              <button
                type="button"
                onClick={() =>
                  audioManager.playText(
                    'header-voice',
                    `${t.appTagline}. ${t.mandatoryDoctorLine}`,
                    language
                  )
                }
                aria-label={t.listenPage}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl bg-teal-50 border border-teal-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap shrink-0"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t.listenPage}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Language & Context Bar (below fold / non-sticky) */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Languages className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleLanguageChange(opt.code)}
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {opt.nativeName}
                </button>
              );
            })}
          </div>
          {translating && (
            <Loader2 className="h-4 w-4 animate-spin text-teal-700 shrink-0" aria-hidden="true" />
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowOnboarding(true)}
          className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-teal-800"
        >
          {t.disclaimerTitle}
        </button>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
        {activeTab === 'today' && (
          <ScheduleView
            language={language}
            schedule={data.schedule}
            caregiver={data.caregiver}
            streakDays={data.patient.streakDays}
            elderlyMode={elderlyMode}
            playingKey={playingKey}
            activeReminderDose={activeReminderDose}
            notificationPermission={notificationPermission}
            onToggleElderlyMode={(enabled) => {
              setElderlyMode(enabled);
              try {
                localStorage.setItem('medisathi.elderly_mode.v1', enabled ? 'true' : 'false');
              } catch {
                // ignore
              }
            }}
            onEnableNotifications={handleEnableNotifications}
            onDoseAction={handleDoseAction}
            onGoToScan={() => setActiveTab('scan')}
            lowSupplyMedicines={data.medicines.filter((m) =>
              m.refillStatus ? m.refillStatus.isLow : m.durationDays <= 3
            )}
            onRequestRefill={handleRequestRefill}
            onGoToMedicines={() => setActiveTab('medicines')}
          />
        )}

        {activeTab === 'scan' && (
          <ScanVerifyView
            language={language}
            samples={data.samples}
            playingKey={playingKey}
            onConfirmSuccess={(payload) => {
              applyPayload(payload as BootstrapPayload);
              setActiveTab('medicines');
            }}
          />
        )}

        {activeTab === 'medicines' && (
          <MedicinesView
            language={language}
            prescriptionTitle={data.prescription?.title || 'Active Prescription'}
            medicines={data.medicines}
            safetyWarnings={data.safetyWarnings}
            playingKey={playingKey}
            onGoToScan={() => setActiveTab('scan')}
            onRequestRefill={handleRequestRefill}
            onMarkRefilled={handleMarkRefilled}
          />
        )}

        {activeTab === 'caregiver' && (
          <CaregiverView
            language={language}
            patient={data.patient}
            caregiver={data.caregiver}
            schedule={data.schedule}
            weeklySummary={data.weeklySummary}
            alerts={data.alerts}
            demoMode={data.demoMode}
            twilioConfigured={data.twilioConfigured}
            playingKey={playingKey}
            onToggleDemoMode={handleToggleDemoMode}
            onFastForwardMissed={handleFastForwardMissed}
            onUpdateConditionsAllergies={handleUpdateConditionsAllergies}
          />
        )}
      </main>

      {/* Quiet Footer Disclaimer */}
      <footer className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80 mt-8">
        <span>{t.mandatoryDoctorLine}</span>
        <span>{t.privacyNote}</span>
      </footer>

      {/* Mobile Bottom Thumb-Zone Navigation (64px) */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden grid grid-cols-4 items-center"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex h-full flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-teal-700 font-bold' : 'text-slate-600 font-medium'
              }`}
            >
              {item.icon}
              <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <OfflineIndicator />

      {emergencyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-red-300 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700 shrink-0">
                  <ShieldAlert className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="emergency-modal-title" className="text-xl font-bold text-red-950">
                    {t.emergencyModalTitle}
                  </h2>
                  <p className="text-sm font-semibold text-red-800">
                    {emergencyModal.caregiverName} ·{' '}
                    {emergencyModal.channel === 'offline'
                      ? 'Direct Call'
                      : emergencyModal.channel === 'in_app'
                        ? 'Caregiver Feed'
                        : emergencyModal.channel.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyModal(null)}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-base font-medium text-slate-800 leading-relaxed">
              {t.emergencyModalBody}
            </p>

            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-950 leading-relaxed">
              {emergencyModal.message}
            </div>

            <a
              href={`tel:${emergencyModal.caregiverPhone.replace(/\s+/g, '')}`}
              className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-red-700 hover:bg-red-800 px-5 py-3.5 text-lg font-bold text-white shadow-sm transition-colors"
            >
              <PhoneCall className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>
                {t.callCaregiverBtn} ({emergencyModal.caregiverPhone})
              </span>
            </a>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  audioManager.playText(
                    'emergency-modal-voice',
                    `${t.emergencyModalTitle}. ${t.emergencyModalBody} ${t.mandatoryDoctorLine}`,
                    language
                  )
                }
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100 px-4 text-sm font-bold text-slate-800"
              >
                <Volume2 className="h-5 w-5" aria-hidden="true" />
                <span>{t.play}</span>
              </button>
              <button
                type="button"
                onClick={() => setEmergencyModal(null)}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 px-4 text-sm font-bold text-slate-800"
              >
                OK
              </button>
            </div>

            <p className="text-xs text-slate-600 text-center">{t.mandatoryDoctorLine}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
