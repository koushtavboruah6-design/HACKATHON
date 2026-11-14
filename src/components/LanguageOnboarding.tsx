import React from 'react';
import { ShieldCheck, Volume2, ArrowRight, Lock } from 'lucide-react';
import type { SupportedLanguage } from '../types';
import { LANGUAGE_OPTIONS, TRANSLATIONS } from '../i18n/translations';
import { audioManager } from '../utils/audioPlayer';

interface LanguageOnboardingProps {
  selectedLanguage: SupportedLanguage;
  playingKey: string | null;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onComplete: () => void;
}

export const LanguageOnboarding: React.FC<LanguageOnboardingProps> = ({
  selectedLanguage,
  playingKey,
  onSelectLanguage,
  onComplete,
}) => {
  const t = TRANSLATIONS[selectedLanguage];

  const handleChooseLanguage = (lang: SupportedLanguage) => {
    onSelectLanguage(lang);
    const option = LANGUAGE_OPTIONS.find((o) => o.code === lang);
    if (option) {
      audioManager.playText(`onboarding-${lang}`, option.greetingSpeech, lang);
    }
  };

  const handleSpeakDisclaimer = () => {
    const text = `${t.disclaimerTitle}. ${t.disclaimerBody} ${t.mandatoryDoctorLine}`;
    audioManager.playText('onboarding-disclaimer', text, selectedLanguage);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] px-4 py-8 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Volume2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            MediSathi
          </h1>
          <p className="text-base text-slate-600">{t.onboardingTitle} · {t.onboardingSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = selectedLanguage === lang.code;
            const isPlaying = playingKey === `onboarding-${lang.code}`;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleChooseLanguage(lang.code)}
                className={`min-h-[84px] rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-3 ${
                  active
                    ? 'border-teal-600 bg-teal-50/90 ring-2 ring-teal-600/20'
                    : 'border-slate-200 bg-white hover:border-teal-300'
                }`}
              >
                <div>
                  <div className="text-xl font-bold text-slate-900">{lang.nativeName}</div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {lang.englishName} · {lang.regionHint}
                  </div>
                </div>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isPlaying
                      ? 'bg-teal-700 text-white'
                      : active
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Volume2 className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6 shrink-0 text-amber-800" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">{t.disclaimerTitle}</h2>
            </div>
            <button
              type="button"
              onClick={handleSpeakDisclaimer}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 shrink-0"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <span>{playingKey === 'onboarding-disclaimer' ? t.stopAudio : t.listenPage}</span>
            </button>
          </div>
          <p className="text-sm leading-relaxed text-slate-800">{t.disclaimerBody}</p>
          <p className="text-sm font-semibold text-teal-900">{t.mandatoryDoctorLine}</p>
          <div className="flex items-start gap-2 pt-2 border-t border-amber-200/70 text-xs text-slate-700">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-600" aria-hidden="true" />
            <span>{t.privacyNote}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            audioManager.stop();
            onComplete();
          }}
          className="w-full min-h-[56px] rounded-2xl bg-teal-700 px-6 py-4 text-lg font-bold text-white shadow-sm hover:bg-teal-800 active:scale-[0.99] transition-all flex items-center justify-center gap-3"
        >
          <span>{t.continueBtn}</span>
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
