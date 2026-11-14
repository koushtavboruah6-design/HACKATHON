import React, { useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  HelpCircle,
  MessageCircleQuestion,
  Mic,
  Send,
  ShieldCheck,
  Square,
  Volume2,
  X,
  Loader2,
  IndianRupee,
} from 'lucide-react';
import type {
  MedicineRecord,
  SafetyWarning,
  SupportedLanguage,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { audioManager } from '../utils/audioPlayer';
import { MedicineVisualBadge } from './MedicineVisualBadge';

interface MedicinesViewProps {
  language: SupportedLanguage;
  prescriptionTitle: string;
  medicines: MedicineRecord[];
  safetyWarnings: SafetyWarning[];
  playingKey: string | null;
  onGoToScan: () => void;
}

export const MedicinesView: React.FC<MedicinesViewProps> = ({
  language,
  prescriptionTitle,
  medicines,
  safetyWarnings,
  playingKey,
  onGoToScan,
}) => {
  const t = TRANSLATIONS[language];
  const [qaOpen, setQaOpen] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const buildMedicineSpeech = (med: MedicineRecord) => {
    const exp = med.explanations[language] || med.explanations.en;
    if (!exp) {
      return `${med.name} ${med.strength}. ${med.doseAmount}, ${t.food[med.foodTiming]}. ${t.mandatoryDoctorLine}`;
    }
    return `${med.name} ${med.strength}. ${exp.usedFor} ${exp.howAndWhen} ${exp.whatToAvoid} ${exp.whenToCallDoctor}`;
  };

  const handlePlayAll = () => {
    const items: Array<{ text: string; language: SupportedLanguage }> = [];
    for (const w of safetyWarnings) {
      if (w.severity === 'high' || w.severity === 'moderate') {
        items.push({ text: `${w.title}. ${w.description} ${w.action}`, language: 'en' });
      }
    }
    for (const med of medicines) {
      items.push({ text: buildMedicineSpeech(med), language });
    }
    if (items.length === 0) return;
    audioManager.playSequence('medicines-all', items);
  };

  const askQuestion = async (payload: {
    question?: string;
    audioBase64?: string;
    mimeType?: string;
  }) => {
    setQaLoading(true);
    setQaError(null);
    try {
      const resp = await fetch('/api/qa/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, language }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not answer question.');
      if (data.question) setQuestionText(data.question);
      setQaAnswer(data.answer);
      audioManager.playText('qa-answer', data.answer, language);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Question failed.');
    } finally {
      setQaLoading(false);
    }
  };

  const toggleVoiceRecord = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    setQaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = typeof reader.result === 'string' ? reader.result : '';
          if (b64) {
            askQuestion({ audioBase64: b64, mimeType: blob.type || 'audio/webm' });
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setQaError('Microphone permission unavailable. You can type your question below.');
    }
  };

  const highOrModerateWarnings = safetyWarnings.filter(
    (w) => w.severity === 'high' || w.severity === 'moderate'
  );
  const uncheckedWarnings = safetyWarnings.filter((w) => w.severity === 'unchecked');

  return (
    <div className="space-y-6">
      {/* Header & Play-All */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">{prescriptionTitle}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5">
              {t.tabs.medicines} ({medicines.length})
            </h1>
            <p className="text-sm font-semibold text-teal-900 mt-1">{t.mandatoryDoctorLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setQaOpen(true);
                setQaAnswer(null);
                setQaError(null);
              }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-900 hover:bg-teal-100 whitespace-nowrap"
            >
              <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
              <span>{t.askQuestionBtn}</span>
            </button>

            <button
              type="button"
              onClick={handlePlayAll}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-5 py-3 text-base font-bold text-white whitespace-nowrap ${
                playingKey === 'medicines-all'
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {playingKey === 'medicines-all' ? (
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
      </section>

      {/* Safety Warnings Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 px-1">{t.safetyTitle}</h2>

        {highOrModerateWarnings.length === 0 && uncheckedWarnings.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
            <div className="text-sm text-emerald-950">
              <p className="font-semibold">{t.noSafetyIssues}</p>
              <p className="mt-0.5 text-emerald-900">{t.mandatoryDoctorLine}</p>
            </div>
          </div>
        )}

        {safetyWarnings.map((w) => {
          const isHigh = w.severity === 'high';
          const isModerate = w.severity === 'moderate';
          const boxStyles = isHigh
            ? 'border-red-300 bg-red-50 text-red-950'
            : isModerate
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-slate-300 bg-slate-100 text-slate-900';

          const warnKey = `warn-${w.id}`;
          return (
            <div key={w.id} className={`rounded-2xl border p-4 sm:p-5 space-y-2 ${boxStyles}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {isHigh ? (
                    <AlertOctagon className="h-6 w-6 shrink-0 text-red-700 mt-0.5" aria-hidden="true" />
                  ) : isModerate ? (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                  ) : (
                    <HelpCircle className="h-6 w-6 shrink-0 text-slate-700 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                      {isHigh ? 'High Safety Alert' : isModerate ? 'Caution' : 'Not Checked'}
                    </p>
                    <h3 className="text-base font-bold mt-0.5">{w.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    audioManager.playText(
                      warnKey,
                      `${w.title}. ${w.description} ${w.action}`,
                      'en'
                    )
                  }
                  aria-label="Speak safety warning"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 border border-black/10 hover:bg-white"
                >
                  {playingKey === warnKey ? (
                    <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="text-sm leading-relaxed">{w.description}</p>
              <p className="text-sm font-semibold">{w.action}</p>
            </div>
          );
        })}
      </section>

      {/* Plain-Language Medicine Cards */}
      {medicines.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <p className="text-slate-700 font-medium">No verified medicines yet.</p>
          <button
            type="button"
            onClick={onGoToScan}
            className="min-h-[48px] rounded-2xl bg-teal-700 px-6 py-3 text-base font-bold text-white"
          >
            {t.scanTitle}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {medicines.map((med) => {
            const exp = med.explanations[language] || med.explanations.en;
            const playKey = `med-${med.id}`;
            const isPlaying = playingKey === playKey;

            return (
              <article
                key={med.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <MedicineVisualBadge
                        medicine={med}
                        language={language}
                        onSpeakVisual={() => {
                          const visualText =
                            med.visualAppearance?.label[language] ||
                            med.visualAppearance?.label.en ||
                            '';
                          audioManager.playText(
                            `visual-${med.id}`,
                            `${med.name} ${med.strength}. ${visualText}. ${t.mandatoryDoctorLine}`,
                            language
                          );
                        }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold text-slate-900 break-words">
                          {med.name}{' '}
                          <span className="font-semibold text-teal-800">{med.strength}</span>
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {med.doseAmount} · {med.slots.map((s) => t.slots[s]).join(' + ')} ·{' '}
                          {t.food[med.foodTiming]} · {med.durationDays}d
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        audioManager.playText(playKey, buildMedicineSpeech(med), language)
                      }
                      className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shrink-0 transition-colors ${
                        isPlaying
                          ? 'bg-slate-900 text-white'
                          : 'bg-teal-700 text-white hover:bg-teal-800'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                          <span>{t.stopAudio}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-5 w-5" aria-hidden="true" />
                          <span>{t.play}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {exp ? (
                    <dl className="space-y-3 border-t border-slate-100 pt-4 text-sm">
                      <div>
                        <dt className="font-bold text-slate-900">{t.usedFor}</dt>
                        <dd className="text-slate-700 mt-0.5 leading-relaxed">{exp.usedFor}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-900">{t.howAndWhen}</dt>
                        <dd className="text-slate-700 mt-0.5 leading-relaxed">{exp.howAndWhen}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-900">{t.whatToAvoid}</dt>
                        <dd className="text-slate-700 mt-0.5 leading-relaxed">{exp.whatToAvoid}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-900">{t.whenToCallDoctor}</dt>
                        <dd className="text-slate-700 mt-0.5 leading-relaxed">
                          {exp.whenToCallDoctor}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">
                      {t.mandatoryDoctorLine}
                    </p>
                  )}

                  {/* Jan Aushadhi Generic Cost-Saving Option */}
                  {med.janAushadhi ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                          <IndianRupee className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                          <span>{t.janAushadhiTitle}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            audioManager.playText(
                              `ja-${med.id}`,
                              `${med.janAushadhi!.genericLabel}. Approximate Jan Aushadhi price ${med.janAushadhi!.janAushadhiPriceInr} rupees for ${med.janAushadhi!.packSize}, compared to around ${med.janAushadhi!.brandedAvgPriceInr} rupees branded. ${t.mandatoryDoctorLine}`,
                              language
                            )
                          }
                          aria-label={`Listen to Jan Aushadhi price for ${med.name}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                        >
                          <Volume2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {med.janAushadhi.genericLabel}
                      </p>
                      <p className="text-sm text-slate-800 tabular-nums">
                        <span className="font-bold text-emerald-800">
                          ₹{med.janAushadhi.janAushadhiPriceInr}
                        </span>{' '}
                        <span className="text-slate-500">vs ~₹{med.janAushadhi.brandedAvgPriceInr} branded</span>
                        {' · '}
                        <span className="font-semibold text-emerald-800">
                          Save ~{med.janAushadhi.savingsPercent}%
                        </span>{' '}
                        <span className="text-xs text-slate-600">({med.janAushadhi.packSize})</span>
                      </p>
                      <p className="text-xs text-slate-600">{t.mandatoryDoctorLine}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {t.janAushadhiNotChecked}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Ask a Question Voice/Text Modal */}
      {qaOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.askQuestionBtn}</h3>
              <button
                type="button"
                onClick={() => setQaOpen(false)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Answers are restricted strictly to your confirmed medicines above. MediSathi never diagnoses or changes doses.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoiceRecord}
                className={`min-h-[48px] shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${
                  recording
                    ? 'bg-red-600 text-white'
                    : 'bg-teal-50 border border-teal-200 text-teal-900 hover:bg-teal-100'
                }`}
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
                <span>{recording ? 'Stop' : 'Speak'}</span>
              </button>

              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. Should I take Omeprazole before food?"
                className="flex-1 min-h-[48px] rounded-2xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />

              <button
                type="button"
                disabled={qaLoading || !questionText.trim()}
                onClick={() => askQuestion({ question: questionText })}
                className="min-h-[48px] rounded-2xl bg-teal-700 px-4 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {qaLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {qaError && (
              <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{qaError}</p>
            )}

            {qaAnswer && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-relaxed text-slate-900">{qaAnswer}</p>
                  <button
                    type="button"
                    onClick={() => audioManager.playText('qa-answer', qaAnswer, language)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-teal-200 text-teal-800"
                  >
                    <Volume2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
