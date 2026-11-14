import React, { useState } from 'react';
import type { MedicineRecord, MedicineVisualAppearance, SupportedLanguage } from '../types';
import formTabletImg from '../assets/images/form_tablet_1794638260481.jpg';
import formCapsuleImg from '../assets/images/form_capsule_1794638260660.jpg';
import formSyrupImg from '../assets/images/form_syrup_1794638261110.jpg';
import formInhalerImg from '../assets/images/form_inhaler_1794638261790.jpg';
import formSachetImg from '../assets/images/form_sachet_1794638261886.jpg';

interface MedicineVisualBadgeProps {
  medicine: MedicineRecord;
  language: SupportedLanguage;
  onSpeakVisual?: () => void;
}

function getFallbackAppearance(medicine: MedicineRecord): MedicineVisualAppearance {
  const txt = `${medicine.name} ${medicine.doseAmount} ${medicine.activeIngredient}`.toLowerCase();
  if (/\binhaler\b|\bpuff\b|\brotacap\b/.test(txt)) {
    return {
      form: 'inhaler',
      primaryColor: '#2563EB',
      label: { en: 'Blue inhaler', hi: 'नीला पंप', as: 'নীলা ইনহেলাৰ', bn: 'নীল ইনহেলার' },
      matchedFromCatalog: false,
    };
  }
  if (/\bsyrup\b|\bsuspension\b|\bml\b/.test(txt)) {
    return {
      form: 'syrup',
      primaryColor: '#D97706',
      label: { en: 'Syrup bottle', hi: 'सिरप बोतल', as: 'চিৰাপ বটল', bn: 'সিরাপ বোতল' },
      matchedFromCatalog: false,
    };
  }
  if (/\bsachet\b|\bors\b|\bpowder\b/.test(txt)) {
    return {
      form: 'sachet',
      primaryColor: '#F97316',
      secondaryColor: '#FFFFFF',
      label: { en: 'Orange sachet', hi: 'नारंगी पैकेट', as: 'কমলা পেকেট', bn: 'কমলা প্যাকেট' },
      matchedFromCatalog: false,
    };
  }
  if (/\bcap\b|\bcapsule\b/.test(txt)) {
    return {
      form: 'capsule',
      primaryColor: '#0F766E',
      secondaryColor: '#FFFFFF',
      label: { en: 'Capsule', hi: 'कैप्सूल', as: 'কেপচুল', bn: 'ক্যাপসুল' },
      matchedFromCatalog: false,
    };
  }
  return {
    form: 'generic',
    primaryColor: '#E2E8F0',
    label: { en: 'Check strip', hi: 'पत्ता देखें', as: 'ষ্ট্ৰিপ চাওক', bn: 'পাতা দেখুন' },
    matchedFromCatalog: false,
  };
}

function getFormStockImage(form: MedicineVisualAppearance['form']): string | null {
  switch (form) {
    case 'round':
    case 'oval':
      return formTabletImg;
    case 'capsule':
      return formCapsuleImg;
    case 'syrup':
      return formSyrupImg;
    case 'inhaler':
      return formInhalerImg;
    case 'sachet':
      return formSachetImg;
    default:
      return null;
  }
}

function renderFallbackSvg(appearance: MedicineVisualAppearance, uid: string) {
  const { form, primaryColor, secondaryColor, scored } = appearance;
  const stroke = '#334155';

  switch (form) {
    case 'round':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <defs>
            <radialGradient id={`round-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="20" fill={primaryColor} stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="32" r="20" fill={`url(#round-${uid})`} />
          {scored && (
            <line
              x1="15"
              y1="32"
              x2="49"
              y2="32"
              stroke={stroke}
              strokeWidth="2"
              strokeOpacity="0.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      );

    case 'oval':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <g transform="rotate(-18 32 32)">
            <rect
              x="7"
              y="20"
              width="50"
              height="24"
              rx="12"
              fill={primaryColor}
              stroke={stroke}
              strokeWidth="2.2"
            />
            {scored && (
              <line x1="32" y1="21" x2="32" y2="43" stroke={stroke} strokeWidth="2" strokeOpacity="0.6" />
            )}
          </g>
        </svg>
      );

    case 'capsule': {
      const rightColor = secondaryColor || '#FFFFFF';
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <defs>
            <clipPath id={`cap-clip-${uid}`}>
              <rect x="7" y="21" width="50" height="22" rx="11" />
            </clipPath>
          </defs>
          <g transform="rotate(-22 32 32)">
            <g clipPath={`url(#cap-clip-${uid})`}>
              <rect x="7" y="21" width="25" height="22" fill={primaryColor} />
              <rect x="32" y="21" width="25" height="22" fill={rightColor} />
            </g>
            <rect x="7" y="21" width="50" height="22" rx="11" fill="none" stroke={stroke} strokeWidth="2.2" />
            <line x1="32" y1="21" x2="32" y2="43" stroke={stroke} strokeWidth="1.8" />
          </g>
        </svg>
      );
    }

    case 'sachet':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <rect
            x="14"
            y="10"
            width="36"
            height="44"
            rx="4"
            fill={secondaryColor || '#FFFFFF'}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect x="15" y="16" width="34" height="14" fill={primaryColor} />
        </svg>
      );

    case 'syrup':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <rect x="24" y="8" width="16" height="8" rx="2" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
          <path
            d="M25 16 H39 L44 24 V52 C44 54 42 56 40 56 H24 C22 56 20 54 20 52 V24 Z"
            fill="#B45309"
            stroke={stroke}
            strokeWidth="2"
          />
          <rect x="22" y="29" width="20" height="16" rx="2" fill="#FFFFFF" />
        </svg>
      );

    case 'inhaler':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <rect x="25" y="9" width="14" height="14" rx="2" fill="#E2E8F0" stroke={stroke} strokeWidth="2" />
          <path
            d="M23 20 H41 V44 L51 44 V53 H28 C25 53 23 50 23 47 Z"
            fill={primaryColor}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'drops':
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <path d="M28 8 L36 8 L38 19 H26 Z" fill="#0F766E" stroke={stroke} strokeWidth="1.8" />
          <rect x="21" y="19" width="22" height="34" rx="5" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
          <path
            d="M32 28 C32 28 38 35 38 39 C38 42.3 35.3 45 32 45 C28.7 45 26 42.3 26 39 C26 35 32 28 32 28 Z"
            fill="#0284C7"
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <circle
            cx="24"
            cy="34"
            r="12"
            fill="#FFFFFF"
            stroke="#475569"
            strokeWidth="2"
            strokeDasharray="3 2"
          />
          <rect
            x="30"
            y="18"
            width="24"
            height="13"
            rx="6.5"
            transform="rotate(-30 42 24.5)"
            fill="#E2E8F0"
            stroke="#475569"
            strokeWidth="2"
          />
        </svg>
      );
  }
}

export const MedicineVisualBadge: React.FC<MedicineVisualBadgeProps> = ({
  medicine,
  language,
  onSpeakVisual,
}) => {
  const [imageError, setImageError] = useState(false);
  const appearance = medicine.visualAppearance || getFallbackAppearance(medicine);
  const labelText = appearance.label[language] || appearance.label.en;
  const stockImageUrl = !imageError ? getFormStockImage(appearance.form) : null;
  const uid = `med-${medicine.id}`;

  return (
    <button
      type="button"
      onClick={onSpeakVisual}
      title={`${medicine.name}: ${labelText}`}
      aria-label={`${medicine.name} visual guide: ${labelText}`}
      className="group flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-100/90 hover:bg-teal-50/70 hover:border-teal-300 px-2 py-2 w-[86px] shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600"
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white overflow-hidden">
        {stockImageUrl ? (
          <img
            src={stockImageUrl}
            alt={labelText}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          renderFallbackSvg(appearance, uid)
        )}

        {appearance.matchedFromCatalog && (
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 flex h-4 w-4 overflow-hidden rounded-full border border-slate-700 shadow-xs"
          >
            <span
              className="h-full flex-1"
              style={{ backgroundColor: appearance.primaryColor }}
            />
            {appearance.secondaryColor && (
              <span
                className="h-full flex-1 border-l border-slate-700"
                style={{ backgroundColor: appearance.secondaryColor }}
              />
            )}
          </span>
        )}
      </div>

      <span className="mt-1.5 text-[11px] font-bold leading-tight text-slate-900 text-center">
        {labelText}
      </span>
    </button>
  );
};
