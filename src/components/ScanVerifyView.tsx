import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileImage,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Volume2,
  ArrowLeft,
} from 'lucide-react';
import type {
  ConfidenceLevel,
  DoseSlot,
  ExtractedMedicineInput,
  FoodTiming,
  SamplePrescriptionMeta,
  SupportedLanguage,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { audioManager } from '../utils/audioPlayer';

interface ScanVerifyViewProps {
  language: SupportedLanguage;
  samples: SamplePrescriptionMeta[];
  playingKey: string | null;
  onConfirmSuccess: (payload: unknown) => void;
}

export const ScanVerifyView: React.FC<ScanVerifyViewProps> = ({
  language,
  samples,
  playingKey,
  onConfirmSuccess,
}) => {
  const t = TRANSLATIONS[language];
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'pick' | 'scanning' | 'verify'>('pick');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clinicTitle, setClinicTitle] = useState('');
  const [sourceType, setSourceType] = useState<'camera' | 'upload' | 'sample'>('sample');
  const [overallConfidence, setOverallConfidence] = useState<ConfidenceLevel>('high');
  const [medicines, setMedicines] = useState<ExtractedMedicineInput[]>([]);
  const [saving, setSaving] = useState(false);

  const runScanRequest = async (body: {
    imageBase64?: string;
    mimeType?: string;
    sampleId?: string;
    srcType: 'camera' | 'upload' | 'sample';
    preview: string | null;
  }) => {
    setError(null);
    setNotice(null);
    setSourceType(body.srcType);
    setPreviewUrl(body.preview);
    setStep('scanning');

    try {
      const resp = await fetch('/api/prescriptions/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: body.imageBase64,
          mimeType: body.mimeType,
          sampleId: body.sampleId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Could not read prescription photo.');
      }

      setClinicTitle(data.clinicTitle || 'Scanned Prescription');
      setOverallConfidence(data.overallConfidence || 'medium');
      setMedicines(data.medicines || []);
      if (data.notice) setNotice(data.notice);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scanning failed. Please try again.');
      setStep('pick');
    }
  };

  const handleFileSelected = (
    e: React.ChangeEvent<HTMLInputElement>,
    srcType: 'camera' | 'upload'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      runScanRequest({
        imageBase64: result,
        mimeType: file.type || 'image/jpeg',
        srcType,
        preview: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSampleClick = (sample: SamplePrescriptionMeta) => {
    runScanRequest({
      sampleId: sample.id,
      srcType: 'sample',
      preview: sample.imageUrl,
    });
  };

  const updateMedField = <K extends keyof ExtractedMedicineInput>(
    index: number,
    field: K,
    value: ExtractedMedicineInput[K]
  ) => {
    setMedicines((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, [field]: value } : m))
    );
  };

  const toggleMedSlot = (index: number, slot: DoseSlot) => {
    setMedicines((prev) =>
      prev.map((m, idx) => {
        if (idx !== index) return m;
        const exists = m.slots.includes(slot);
        const nextSlots = exists
          ? m.slots.filter((s) => s !== slot)
          : [...m.slots, slot];
        const finalSlots: DoseSlot[] = nextSlots.length > 0 ? nextSlots : [slot];
        const freq = `${finalSlots.includes('morning') ? '1' : '0'}-${
          finalSlots.includes('afternoon') ? '1' : '0'
        }-${finalSlots.includes('night') ? '1' : '0'}`;
        return { ...m, slots: finalSlots, frequencyCode: freq };
      })
    );
  };

  const addBlankMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        tempId: `custom-${Date.now()}`,
        name: '',
        strength: '',
        doseAmount: '1 tablet',
        frequencyCode: '1-0-0',
        slots: ['morning'],
        foodTiming: 'after_food',
        durationDays: 5,
        specialInstructions: '',
        confidence: 'high',
      },
    ]);
  };

  const removeMedicine = (index: number) => {
    setMedicines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmAndSave = async () => {
    const validMeds = medicines.filter((m) => m.name.trim().length > 0);
    if (validMeds.length === 0) {
      setError('Please enter at least one medicine name before confirming.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/prescriptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: clinicTitle,
          sourceType,
          overallConfidence,
          medicines: validMeds,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Could not save prescription.');
      }
      onConfirmSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medicines.');
    } finally {
      setSaving(false);
    }
  };

  const hasUnclearItem =
    overallConfidence === 'low' || medicines.some((m) => m.confidence === 'low');

  if (step === 'scanning') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t.readingRx}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Checking medicine names, strengths, and before/after meal timing.
        </p>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Rescan</span>
            </button>

            <button
              type="button"
              onClick={() =>
                audioManager.playText(
                  'verify-help',
                  `${t.confirmTitle}. ${t.confirmSubtitle} ${t.mandatoryDoctorLine}`,
                  language
                )
              }
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <span>{playingKey === 'verify-help' ? t.stopAudio : t.listenPage}</span>
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t.confirmTitle}</h1>
            <p className="text-sm text-slate-600 mt-1">{t.confirmSubtitle}</p>
          </div>

          {hasUnclearItem && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              <span>{t.lowConfAlert}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-900">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Reference Prescription Photo */}
          {previewUrl && (
            <div className="lg:col-span-4 rounded-3xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Prescription Photo</p>
              <img
                src={previewUrl}
                alt="Uploaded prescription reference"
                referrerPolicy="no-referrer"
                className="w-full rounded-2xl border border-slate-100 object-cover max-h-96"
              />
            </div>
          )}

          {/* Editable Medicine Verification Cards */}
          <div className={`${previewUrl ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
            {medicines.map((med, idx) => {
              const isUnclear = med.confidence === 'low' || med.confidence === 'medium';
              return (
                <div
                  key={med.tempId || idx}
                  className={`rounded-3xl border p-5 space-y-4 ${
                    med.confidence === 'low'
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-bold text-slate-500 tabular-nums">
                      Medicine {idx + 1}
                      {isUnclear && (
                        <span className="ml-2 font-semibold text-amber-800">
                          · Please verify reading
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedicine(idx)}
                      aria-label="Remove medicine"
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {med.unclearReason && (
                    <p className="text-xs font-medium text-amber-900 bg-amber-100/70 rounded-xl px-3 py-2">
                      {med.unclearReason}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="sm:col-span-2 block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Medicine Name</span>
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => updateMedField(idx, 'name', e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Strength</span>
                      <input
                        type="text"
                        value={med.strength}
                        onChange={(e) => updateMedField(idx, 'strength', e.target.value)}
                        placeholder="e.g. 500mg"
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Dose</span>
                      <input
                        type="text"
                        value={med.doseAmount}
                        onChange={(e) => updateMedField(idx, 'doseAmount', e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Meal Timing</span>
                      <select
                        value={med.foodTiming}
                        onChange={(e) =>
                          updateMedField(idx, 'foodTiming', e.target.value as FoodTiming)
                        }
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      >
                        <option value="after_food">{t.food.after_food}</option>
                        <option value="before_food">{t.food.before_food}</option>
                        <option value="with_food">{t.food.with_food}</option>
                        <option value="any">{t.food.any}</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Days</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={med.durationDays}
                        onChange={(e) =>
                          updateMedField(idx, 'durationDays', Number(e.target.value) || 1)
                        }
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">When to take</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['morning', 'afternoon', 'night'] as DoseSlot[]).map((slot) => {
                        const active = med.slots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleMedSlot(idx, slot)}
                            className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                              active
                                ? 'border-teal-700 bg-teal-700 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {t.slots[slot]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={addBlankMedicine}
                className="min-h-[48px] rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Medicine</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmAndSave}
                className="flex-1 min-h-[54px] rounded-2xl bg-teal-700 px-6 py-3.5 text-base font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-60 flex items-center justify-center gap-2.5"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-5 w-5" aria-hidden="true" />
                )}
                <span>{t.confirmSaveBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload / Camera Hero */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t.scanTitle}</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">{t.scanSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              audioManager.playText(
                'scan-intro',
                `${t.scanTitle}. ${t.scanSubtitle} ${t.mandatoryDoctorLine}`,
                language
              )
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 shrink-0"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>{playingKey === 'scan-intro' ? t.stopAudio : t.listenPage}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
            {error}
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelected(e, 'camera')}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelected(e, 'upload')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="min-h-[76px] rounded-2xl bg-teal-700 px-5 py-4 text-left text-white hover:bg-teal-800 transition-colors flex items-center gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Camera className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold">{t.takePhotoBtn}</div>
              <div className="text-xs text-teal-100">Use phone camera</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="min-h-[76px] rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 text-left text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-700">
              <Upload className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold">{t.uploadPhotoBtn}</div>
              <div className="text-xs text-slate-600">Pick from gallery</div>
            </div>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {t.privacyNote}
        </p>
      </section>

      {/* 3 Sample Prescriptions */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileImage className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">{t.orTrySample}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSampleClick(sample)}
              className="group rounded-3xl border border-slate-200 bg-white p-3.5 text-left hover:border-teal-500 transition-all flex flex-col gap-3"
            >
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-100">
                <img
                  src={sample.imageUrl}
                  alt={sample.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover object-top group-hover:scale-[1.02] transition-transform"
                />
              </div>
              <div className="px-1 pb-1">
                <h3 className="text-base font-bold text-slate-900">{sample.title}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{sample.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
