import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  PhoneCall,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  CaregiverProfile,
  DoseScheduleItem,
  DoseSlot,
  FoodTiming,
  SupportedLanguage,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { audioManager } from '../utils/audioPlayer';

interface ScheduleViewProps {
  language: SupportedLanguage;
  schedule: DoseScheduleItem[];
  caregiver: CaregiverProfile;
  streakDays: number;
  elderlyMode: boolean;
  playingKey: string | null;
  activeReminderDose: DoseScheduleItem | null;
  notificationPermission: NotificationPermission | 'unsupported';
  onToggleElderlyMode: (enabled: boolean) => void;
  onEnableNotifications: () => void;
  onDoseAction: (doseId: number, action: 'taken' | 'skipped') => void;
  onGoToScan: () => void;
}

const SLOT_ORDER: DoseSlot[] = ['morning', 'afternoon', 'night'];

function getCurrentTimeSlot(): DoseSlot {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

function parsePillCount(doseAmount: string): number {
  const match = doseAmount.match(/\d+/);
  const count = match ? Number(match[0]) : 1;
  return Math.min(Math.max(count, 1), 4);
}

/** High-contrast custom SVG time-of-day artwork for Morning, Afternoon, and Night cards */
const SlotSceneIllustration: React.FC<{ slot: DoseSlot }> = ({ slot }) => {
  if (slot === 'morning') {
    return (
      <svg
        className="h-16 w-16 sm:h-20 sm:w-20 shrink-0"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
      >
        <rect width="80" height="80" rx="20" fill="#FDE68A" />
        {/* Sunbeams */}
        <path
          d="M40 12V20M20 21L26 27M60 21L54 27M13 41H21M59 41H67"
          stroke="#B45309"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Rising sun */}
        <circle cx="40" cy="43" r="15" fill="#F59E0B" stroke="#92400E" strokeWidth="3" />
        {/* Horizon hills */}
        <path
          d="M6 57C18 48 30 50 42 56C54 62 66 52 74 55V68C74 71.3 71.3 74 68 74H12C8.7 74 6 71.3 6 68V57Z"
          fill="#0F766E"
        />
      </svg>
    );
  }

  if (slot === 'afternoon') {
    return (
      <svg
        className="h-16 w-16 sm:h-20 sm:w-20 shrink-0"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
      >
        <rect width="80" height="80" rx="20" fill="#FED7AA" />
        {/* Radiant midday sun */}
        <circle cx="40" cy="40" r="16" fill="#EA580C" stroke="#7C2D12" strokeWidth="3" />
        <path
          d="M40 10V18M40 62V70M10 40H18M62 40H70M18.8 18.8L24.5 24.5M55.5 55.5L61.2 61.2M61.2 18.8L55.5 24.5M24.5 55.5L18.8 61.2"
          stroke="#9A3412"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Night crescent moon + stars on deep indigo sky
  return (
    <svg
      className="h-16 w-16 sm:h-20 sm:w-20 shrink-0"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <rect width="80" height="80" rx="20" fill="#312E81" />
      <path
        d="M47 20C36.5 20 28 28.5 28 39C28 49.5 36.5 58 47 58C52 58 56.5 56 59.8 52.8C51.4 53.5 43.5 46.8 43.5 38.2C43.5 30.8 49 24.4 56 22.8C53.3 21 50.3 20 47 20Z"
        fill="#FDE047"
        stroke="#FEF9C3"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="24" r="2.5" fill="#FEF08A" />
      <circle cx="61" cy="28" r="2" fill="#FEF08A" />
      <circle cx="25" cy="57" r="2" fill="#FEF08A" />
      <path d="M58 61L59.5 57L61 61L65 62.5L61 64L59.5 68L58 64L54 62.5L58 61Z" fill="#FEF9C3" />
    </svg>
  );
};

/** Picture-only SVG indicating Before Food vs After Food vs With Water */
const MealPictureIcon: React.FC<{ foodTiming: FoodTiming }> = ({ foodTiming }) => {
  if (foodTiming === 'before_food') {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-2.5 py-2 shrink-0"
        title="Before food"
      >
        <svg className="h-9 w-9 text-amber-900" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M10 26C10 34.2843 16.268 41 24 41C31.732 41 38 34.2843 38 26H10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 14L22 20M22 14L16 20" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" />
          <circle cx="33" cy="15" r="6" stroke="currentColor" strokeWidth="2.5" />
          <path d="M33 12V15L35 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-[11px] font-bold text-amber-950 mt-0.5 whitespace-nowrap">Empty Stomach</span>
      </div>
    );
  }

  if (foodTiming === 'any') {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 px-2.5 py-2 shrink-0"
        title="With water"
      >
        <svg className="h-9 w-9 text-sky-900" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M14 10H34L31 39H17L14 10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 23H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-[11px] font-bold text-sky-950 mt-0.5 whitespace-nowrap">Water</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-teal-300 bg-teal-50 px-2.5 py-2 shrink-0"
      title="After food"
    >
      <svg className="h-9 w-9 text-teal-900" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M10 26C10 34.2843 16.268 41 24 41C31.732 41 38 34.2843 38 26H10Z" fill="#CCFBF1" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M14 26C16 20 20 18 24 18C28 18 32 20 34 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 11V14M24 9V13M30 11V14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="text-[11px] font-bold text-teal-950 mt-0.5 whitespace-nowrap">After Meal</span>
    </div>
  );
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  language,
  schedule,
  caregiver,
  streakDays,
  elderlyMode,
  playingKey,
  activeReminderDose,
  notificationPermission,
  onToggleElderlyMode,
  onEnableNotifications,
  onDoseAction,
  onGoToScan,
}) => {
  const t = TRANSLATIONS[language];
  const [callBannerOpen, setCallBannerOpen] = useState(false);

  const takenCount = schedule.filter((d) => d.status === 'taken').length;
  const totalCount = schedule.length;
  const currentSlot = getCurrentTimeSlot();

  const slotTimesDisplay: Record<DoseSlot, string> = {
    morning: '8:00 AM',
    afternoon: '1:00 PM',
    night: '9:00 PM',
  };

  const slotHeaderTheme: Record<
    DoseSlot,
    { bg: string; titleColor: string; subColor: string; btnClass: string }
  > = {
    morning: {
      bg: 'bg-[#FEF3C7] border-b border-amber-300',
      titleColor: 'text-[#78350F]',
      subColor: 'text-[#92400E]',
      btnClass: 'bg-white text-[#78350F] border border-amber-300 hover:bg-amber-50',
    },
    afternoon: {
      bg: 'bg-[#FFEDD5] border-b border-orange-300',
      titleColor: 'text-[#7C2D12]',
      subColor: 'text-[#9A3412]',
      btnClass: 'bg-white text-[#7C2D12] border border-orange-300 hover:bg-orange-50',
    },
    night: {
      bg: 'bg-[#1E1B4B] border-b border-indigo-900',
      titleColor: 'text-white',
      subColor: 'text-indigo-200',
      btnClass: 'bg-indigo-800 text-white border border-indigo-600 hover:bg-indigo-700',
    },
  };

  const buildDoseSpeech = (dose: DoseScheduleItem) => {
    const slotText = t.slots[dose.slot];
    const foodText = t.food[dose.foodTiming];
    return `${slotText}. ${dose.medicineName} ${dose.strength}. ${dose.doseAmount}, ${foodText}. ${t.mandatoryDoctorLine}`;
  };

  const handlePlayAllToday = () => {
    if (schedule.length === 0) {
      audioManager.playText(
        'today-empty',
        `${t.scanTitle}. ${t.mandatoryDoctorLine}`,
        language
      );
      return;
    }
    const items = schedule.map((dose) => ({
      text: buildDoseSpeech(dose),
      language,
    }));
    audioManager.playSequence('today-all', items);
  };

  const handlePlaySlot = (slot: DoseSlot, slotItems: DoseScheduleItem[]) => {
    const items = slotItems.map((dose) => ({
      text: buildDoseSpeech(dose),
      language,
    }));
    audioManager.playSequence(`slot-${slot}`, items);
  };

  const handleCallCaregiver = () => {
    setCallBannerOpen(true);
    audioManager.playText(
      'call-caregiver',
      `${t.callCaregiverBtn}: ${caregiver.name}.`,
      language
    );
  };

  const telHref = `tel:${caregiver.phone.replace(/\s+/g, '')}`;

  return (
    <div className="space-y-6">
      {/* Summary, Picture Mode Toggle, Play All & Call Caregiver */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{t.tabs.today}</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {takenCount} / {totalCount} {t.status.taken}
            </h1>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800 tabular-nums">
                <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
                {streakDays} {t.days} {t.streakLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t.mandatoryDoctorLine}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onToggleElderlyMode(!elderlyMode)}
              aria-pressed={elderlyMode}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
                elderlyMode
                  ? 'border-teal-700 bg-teal-50 text-teal-900'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Eye className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <span>{t.elderlyModeLabel}</span>
            </button>

            {notificationPermission === 'default' && (
              <button
                type="button"
                onClick={onEnableNotifications}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
              >
                <Bell className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>Alerts</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePlayAllToday}
              className={`inline-flex min-h-[48px] items-center gap-2.5 rounded-2xl px-5 py-3 text-base font-bold text-white shadow-xs transition-colors whitespace-nowrap ${
                playingKey === 'today-all'
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {playingKey === 'today-all' ? (
                <>
                  <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                  <span>{t.stopAudio}</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-5 w-5" aria-hidden="true" />
                  <span>{t.playAll}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* One-Tap Call My Caregiver Action Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <a
            href={telHref}
            onClick={handleCallCaregiver}
            className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-base font-bold text-rose-900 hover:bg-rose-100 transition-colors"
          >
            <PhoneCall className="h-5 w-5 text-rose-700 shrink-0" aria-hidden="true" />
            <span>{t.callCaregiverBtn}</span>
            <span className="text-sm font-semibold text-rose-800 tabular-nums">
              · {caregiver.name.split(' ')[0]} ({caregiver.phone})
            </span>
          </a>

          {callBannerOpen && (
            <p className="text-xs font-semibold text-rose-900 bg-rose-50 rounded-xl px-3 py-2 border border-rose-200 tabular-nums">
              Dialing {caregiver.name} at {caregiver.phone}…
            </p>
          )}
        </div>
      </section>

      {/* Active Due Dose Reminder Banner */}
      {activeReminderDose && (
        <section
          role="alert"
          className="rounded-3xl border border-teal-300 bg-teal-50 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white">
                <Bell className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-teal-900">
                  {t.reminderBannerTitle} · {t.slots[activeReminderDose.slot]}
                </p>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {activeReminderDose.medicineName} {activeReminderDose.strength}
                </h2>
                <p className="text-sm text-slate-700 mt-0.5">
                  {activeReminderDose.doseAmount} · {t.food[activeReminderDose.foodTiming]}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                audioManager.playText(
                  `rem-${activeReminderDose.doseId}`,
                  buildDoseSpeech(activeReminderDose),
                  language
                )
              }
              aria-label={t.play}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white border border-teal-200 text-teal-800 hover:bg-teal-100"
            >
              <Volume2 className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onDoseAction(activeReminderDose.doseId, 'taken')}
              className="min-h-[52px] rounded-2xl bg-teal-700 px-4 py-3 text-base font-bold text-white hover:bg-teal-800 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <span>{t.takenBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => onDoseAction(activeReminderDose.doseId, 'skipped')}
              className="min-h-[52px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <SkipForward className="h-5 w-5" aria-hidden="true" />
              <span>{t.skipBtn}</span>
            </button>
          </div>
        </section>
      )}

      {/* Empty State */}
      {schedule.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <p className="text-lg font-semibold text-slate-800">
            No medicines scheduled for today yet.
          </p>
          <button
            type="button"
            onClick={onGoToScan}
            className="min-h-[48px] rounded-2xl bg-teal-700 px-6 py-3 text-base font-bold text-white hover:bg-teal-800"
          >
            {t.scanTitle}
          </button>
        </div>
      ) : (
        /* Distinct Grouped Morning / Afternoon / Night Cards */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {SLOT_ORDER.map((slot) => {
            const slotItems = schedule.filter((d) => d.slot === slot);
            if (slotItems.length === 0) return null;

            const theme = slotHeaderTheme[slot];
            const slotTaken = slotItems.filter((d) => d.status === 'taken').length;
            const slotPending = slotItems.some((d) => d.status === 'pending');
            const isDueNow = slot === currentSlot && slotPending;
            const slotPlayKey = `slot-${slot}`;
            const isSlotPlaying = playingKey === slotPlayKey;

            return (
              <section
                key={slot}
                className={`rounded-3xl border-2 bg-white overflow-hidden transition-shadow ${
                  isDueNow
                    ? 'border-teal-600 shadow-md ring-2 ring-teal-600/15'
                    : 'border-slate-200 shadow-xs'
                }`}
              >
                {/* High-Contrast Time-of-Day Card Header with Large Imagery */}
                <div className={`p-4 sm:p-5 ${theme.bg}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <SlotSceneIllustration slot={slot} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${theme.titleColor}`}>
                            {t.slots[slot]}
                          </h2>
                          {isDueNow && (
                            <span
                              className={`text-xs font-bold uppercase tracking-wide ${
                                slot === 'night' ? 'text-amber-300' : 'text-teal-800'
                              }`}
                            >
                              · Due now
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-semibold tabular-nums mt-0.5 ${theme.subColor}`}>
                          {slotTimesDisplay[slot]} · {slotTaken}/{slotItems.length} {t.status.taken}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlaySlot(slot, slotItems)}
                      aria-label={`${t.play} ${t.slots[slot]}`}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${theme.btnClass}`}
                    >
                      {isSlotPlaying ? (
                        <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-6 w-6" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Hairline-Divided Dose Rows inside the Time-of-Day Card */}
                <div className="divide-y divide-slate-200">
                  {slotItems.map((dose) => {
                    const key = `dose-${dose.doseId}`;
                    const isPlaying = playingKey === key;
                    const isDone = dose.status === 'taken';
                    const isMissed = dose.status === 'missed';
                    const pillCount = parsePillCount(dose.doseAmount);

                    return (
                      <div
                        key={dose.doseId}
                        className={`p-4 sm:p-5 space-y-3.5 transition-colors ${
                          isDone
                            ? 'bg-emerald-50/50'
                            : isMissed
                              ? 'bg-red-50/50'
                              : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {elderlyMode && <MealPictureIcon foodTiming={dose.foodTiming} />}

                            <div className="space-y-1 min-w-0">
                              {elderlyMode && (
                                <div className="flex items-center gap-1.5" aria-label={`${pillCount} tablet`}>
                                  {Array.from({ length: pillCount }).map((_, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex h-6 w-10 items-center justify-center rounded-full border-2 border-teal-700 bg-teal-100"
                                    >
                                      <span className="h-2.5 w-4 rounded-full bg-teal-700" />
                                    </span>
                                  ))}
                                </div>
                              )}

                              <h3 className={elderlyMode ? 'text-xl font-bold text-slate-900' : 'text-lg font-bold text-slate-900'}>
                                {dose.medicineName}{' '}
                                {!elderlyMode && (
                                  <span className="font-semibold text-slate-600">
                                    {dose.strength}
                                  </span>
                                )}
                              </h3>

                              {!elderlyMode && (
                                <p className="text-sm text-slate-700">
                                  {dose.doseAmount} · {t.food[dose.foodTiming]}
                                </p>
                              )}

                              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                <span
                                  className={
                                    isDone
                                      ? 'text-emerald-800 font-bold'
                                      : isMissed
                                        ? 'text-red-800 font-bold'
                                        : 'text-slate-600'
                                  }
                                >
                                  {t.status[dose.status]}
                                </span>
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              audioManager.playText(key, buildDoseSpeech(dose), language)
                            }
                            aria-label={`${t.play} ${dose.medicineName}`}
                            className={`flex shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                              elderlyMode ? 'h-14 w-14' : 'h-12 w-12'
                            } ${
                              isPlaying
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                            }`}
                          >
                            {isPlaying ? (
                              <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                            ) : (
                              <Volume2 className={elderlyMode ? 'h-7 w-7' : 'h-6 w-6'} aria-hidden="true" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => onDoseAction(dose.doseId, 'taken')}
                            className={`rounded-xl px-4 py-2.5 font-bold transition-colors flex items-center justify-center gap-2 ${
                              elderlyMode ? 'min-h-[60px] text-base' : 'min-h-[48px] text-sm'
                            } ${
                              isDone
                                ? 'bg-emerald-700 text-white'
                                : 'bg-teal-700 text-white hover:bg-teal-800'
                            }`}
                          >
                            {elderlyMode ? (
                              <Check className="h-6 w-6 stroke-[3]" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                            )}
                            <span>{t.takenBtn}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDoseAction(dose.doseId, 'skipped')}
                            className={`rounded-xl border px-4 py-2.5 font-semibold transition-colors flex items-center justify-center gap-2 ${
                              elderlyMode ? 'min-h-[60px] text-base' : 'min-h-[48px] text-sm'
                            } ${
                              dose.status === 'skipped'
                                ? 'border-slate-400 bg-slate-200 text-slate-900'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <SkipForward className="h-4 w-4" aria-hidden="true" />
                            <span>{t.skipBtn}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
