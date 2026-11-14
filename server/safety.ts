import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ExtractedMedicineInput,
  JanAushadhiOption,
  MedicineVisualAppearance,
  MedicineVisualForm,
  SafetyWarning,
  SupportedLanguage,
} from './types.js';

interface CatalogVisual {
  form: MedicineVisualForm;
  primaryColor: string;
  secondaryColor?: string;
  scored?: boolean;
  colorKey: string;
  secondaryColorKey?: string;
}

interface CatalogMedicine {
  id: string;
  genericName: string;
  aliases: string[];
  activeIngredients: string[];
  drugClass: string;
  commonUse: string;
  allergyGroups: string[];
  cautionConditions: string[];
  janAushadhi?: {
    genericLabel: string;
    janAushadhiPriceInr: number;
    brandedAvgPriceInr: number;
    packSize: string;
  };
  visual?: CatalogVisual;
}

interface CatalogInteraction {
  pair: [string, string];
  severity: 'high' | 'moderate';
  title: string;
  explanation: string;
  action: string;
}

interface SafetyDataset {
  datasetVersion: string;
  disclaimer: string;
  medicines: CatalogMedicine[];
  interactions: CatalogInteraction[];
}

const datasetPath = join(process.cwd(), 'data', 'medicines_safety.json');
const safetyDataset: SafetyDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

/**
 * Matches a medicine name or active ingredient string to entries in the curated
 * ~32-medicine Indian primary-care dataset. Returns all matched catalog records
 * (combination tablets like Combiflam match both Ibuprofen and Paracetamol or Combiflam itself).
 */
export function matchCatalogMedicines(name: string, activeIngredient = ''): CatalogMedicine[] {
  const haystack = `${name} ${activeIngredient}`
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .trim();

  const matches: CatalogMedicine[] = [];
  for (const med of safetyDataset.medicines) {
    const terms = [med.id, med.genericName.toLowerCase(), ...med.aliases.map((a) => a.toLowerCase())];
    const matched = terms.some((term) => {
      if (term.length < 3) return false;
      return haystack.includes(term);
    });
    if (matched) {
      matches.push(med);
    }
  }

  // Prefer specific combination entry if present alongside single ingredients,
  // while keeping active ingredient coverage accurate.
  return matches;
}

/**
 * Runs deterministic safety checks across all medicines in a prescription:
 * 1. Uncatalogued medicines -> explicit "not checked" warning (never assumed safe)
 * 2. Duplicate active ingredients
 * 3. Known drug-drug interactions from curated dataset
 * 4. Patient allergy & medical condition conflicts
 */
export function evaluatePrescriptionSafety(
  medicines: Array<Pick<ExtractedMedicineInput, 'name' | 'activeIngredient'>>,
  patientConditions: string[],
  patientAllergies: string[]
): {
  overallWarnings: SafetyWarning[];
  perMedicineWarnings: Record<number, SafetyWarning[]>;
} {
  const overallWarnings: SafetyWarning[] = [];
  const perMedicineWarnings: Record<number, SafetyWarning[]> = {};

  const matchedPerIndex: CatalogMedicine[][] = medicines.map((m, idx) => {
    perMedicineWarnings[idx] = [];
    return matchCatalogMedicines(m.name, m.activeIngredient || '');
  });

  // 1. Flag medicines outside our curated dataset as "not checked" (never say "safe")
  medicines.forEach((med, idx) => {
    if (matchedPerIndex[idx].length === 0) {
      const warning: SafetyWarning = {
        id: `not-checked-${idx}`,
        severity: 'unchecked',
        category: 'not_checked',
        title: `${med.name}: Safety check not available`,
        description: `${med.name} is not in MediSathi's 32-medicine reference list, so interactions could not be checked automatically.`,
        action: 'Do not assume this medicine is interaction-free. Please confirm with your doctor or pharmacist.',
        medicinesInvolved: [med.name],
      };
      overallWarnings.push(warning);
      perMedicineWarnings[idx].push(warning);
    }
  });

  // 2. Check duplicate active ingredients across different prescription lines
  const ingredientOwners = new Map<string, Array<{ idx: number; medName: string }>>();
  medicines.forEach((med, idx) => {
    const ingredients = new Set<string>();
    for (const catalogMed of matchedPerIndex[idx]) {
      for (const ing of catalogMed.activeIngredients) {
        ingredients.add(ing.toLowerCase());
      }
    }
    if (med.activeIngredient) {
      for (const part of med.activeIngredient.split(/[,+/]/)) {
        const cleaned = part.trim().toLowerCase();
        if (cleaned.length >= 3) ingredients.add(cleaned);
      }
    }
    for (const ing of ingredients) {
      const list = ingredientOwners.get(ing) ?? [];
      list.push({ idx, medName: med.name });
      ingredientOwners.set(ing, list);
    }
  });

  for (const [ingredient, owners] of ingredientOwners.entries()) {
    if (owners.length > 1) {
      const names = Array.from(new Set(owners.map((o) => o.medName)));
      const label = ingredient.charAt(0).toUpperCase() + ingredient.slice(1);
      const warning: SafetyWarning = {
        id: `dup-${ingredient}`,
        severity: 'high',
        category: 'duplicate',
        title: `Duplicate ingredient: ${label}`,
        description: `More than one medicine on this prescription contains ${label} (${names.join(' + ')}). Taking both can cause an accidental double dose.`,
        action: 'Please confirm with your doctor or pharmacist before taking both.',
        medicinesInvolved: names,
      };
      overallWarnings.push(warning);
      for (const owner of owners) {
        perMedicineWarnings[owner.idx].push(warning);
      }
    }
  }

  // 3. Check known drug-drug interaction pairs
  const seenPairs = new Set<string>();
  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const idsA = new Set<string>();
      for (const m of matchedPerIndex[i]) {
        idsA.add(m.id);
        m.activeIngredients.forEach((ing) => idsA.add(ing));
      }
      const idsB = new Set<string>();
      for (const m of matchedPerIndex[j]) {
        idsB.add(m.id);
        m.activeIngredients.forEach((ing) => idsB.add(ing));
      }

      for (const rule of safetyDataset.interactions) {
        const [a, b] = rule.pair;
        const hitForward = idsA.has(a) && idsB.has(b);
        const hitReverse = idsA.has(b) && idsB.has(a);
        if (hitForward || hitReverse) {
          const pairKey = [a, b].sort().join('::');
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const involved = [medicines[i].name, medicines[j].name];
          const warning: SafetyWarning = {
            id: `int-${pairKey}`,
            severity: rule.severity,
            category: 'interaction',
            title: `${rule.title} (${involved.join(' + ')})`,
            description: rule.explanation,
            action: `${rule.action} Please confirm with your doctor or pharmacist.`,
            medicinesInvolved: involved,
          };
          overallWarnings.push(warning);
          perMedicineWarnings[i].push(warning);
          perMedicineWarnings[j].push(warning);
        }
      }
    }
  }

  // 4. Check patient allergies & existing health conditions
  const normAllergies = patientAllergies.map((a) => a.trim().toLowerCase()).filter(Boolean);
  const normConditions = patientConditions.map((c) => c.trim().toLowerCase()).filter(Boolean);

  medicines.forEach((med, idx) => {
    for (const catalogMed of matchedPerIndex[idx]) {
      for (const allergy of normAllergies) {
        const allergyHit =
          catalogMed.allergyGroups.some((g) => allergy.includes(g) || g.includes(allergy)) ||
          catalogMed.genericName.toLowerCase().includes(allergy);
        if (allergyHit) {
          const warning: SafetyWarning = {
            id: `allergy-${idx}-${allergy}`,
            severity: 'high',
            category: 'allergy',
            title: `Allergy Alert: ${med.name}`,
            description: `Your profile lists an allergy to "${allergy}", which matches ${catalogMed.genericName} (${catalogMed.drugClass}).`,
            action: 'Do not take this until you confirm with your doctor or pharmacist.',
            medicinesInvolved: [med.name],
          };
          if (!perMedicineWarnings[idx].some((w) => w.id === warning.id)) {
            overallWarnings.push(warning);
            perMedicineWarnings[idx].push(warning);
          }
        }
      }

      for (const condition of normConditions) {
        const condHit = catalogMed.cautionConditions.some(
          (c) => condition.includes(c) || c.includes(condition) || (condition.includes('ulcer') && c.includes('ulcer'))
        );
        if (condHit) {
          const warning: SafetyWarning = {
            id: `cond-${idx}-${condition}`,
            severity: 'moderate',
            category: 'condition',
            title: `Health Condition Caution: ${med.name}`,
            description: `${catalogMed.genericName} requires extra care for people with "${condition}".`,
            action: 'Mention this condition and confirm with your doctor or pharmacist.',
            medicinesInvolved: [med.name],
          };
          if (!perMedicineWarnings[idx].some((w) => w.id === warning.id)) {
            overallWarnings.push(warning);
            perMedicineWarnings[idx].push(warning);
          }
        }
      }
    }
  });

  // Sort high severity first, then moderate, then unchecked
  const rank = { high: 0, moderate: 1, unchecked: 2 };
  overallWarnings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return { overallWarnings, perMedicineWarnings };
}

export function getJanAushadhiAlternative(
  name: string,
  activeIngredient = ''
): JanAushadhiOption | null {
  const matches = matchCatalogMedicines(name, activeIngredient);
  if (matches.length === 0) return null;

  // Prefer combination entry (e.g. Combiflam) when multiple catalog items match
  const preferred =
    matches.find((m) => m.activeIngredients.length > 1 && m.janAushadhi) ||
    matches.find((m) => m.janAushadhi);

  if (!preferred?.janAushadhi) return null;

  const { genericLabel, janAushadhiPriceInr, brandedAvgPriceInr, packSize } =
    preferred.janAushadhi;
  const savingsPercent =
    brandedAvgPriceInr > janAushadhiPriceInr
      ? Math.round(((brandedAvgPriceInr - janAushadhiPriceInr) / brandedAvgPriceInr) * 100)
      : 0;

  return {
    genericLabel,
    janAushadhiPriceInr,
    brandedAvgPriceInr,
    packSize,
    savingsPercent,
  };
}

const COLOR_WORDS: Record<string, Record<SupportedLanguage, string>> = {
  white: { en: 'White', hi: 'सफेद', as: 'বগা', bn: 'সাদা' },
  pink: { en: 'Pink', hi: 'गुलाबी', as: 'গুলপীয়া', bn: 'গোলাপি' },
  yellow: { en: 'Yellow', hi: 'पीली', as: 'হালধীয়া', bn: 'হলুদ' },
  orange: { en: 'Orange', hi: 'नारंगी', as: 'কমলা', bn: 'কমলা' },
  green: { en: 'Green', hi: 'हरी', as: 'সেউজীয়া', bn: 'সবুজ' },
  red: { en: 'Red', hi: 'लाल', as: 'ৰঙা', bn: 'লাল' },
  maroon: { en: 'Dark red', hi: 'गहरी लाल', as: 'গাঢ় ৰঙা', bn: 'গাঢ় লাল' },
  cream: { en: 'Cream', hi: 'हल्की पीली', as: 'ক্ৰীম', bn: 'হালকা হলুদ' },
  blue: { en: 'Blue', hi: 'नीली', as: 'নীলা', bn: 'নীল' },
};

const FORM_WORDS: Record<MedicineVisualForm, Record<SupportedLanguage, string>> = {
  round: { en: 'round', hi: 'गोल गोली', as: 'ঘূৰণীয়া', bn: 'গোল ট্যাবলেট' },
  oval: { en: 'oval', hi: 'लंबी गोली', as: 'দীঘলীয়া', bn: 'লম্বাটে ট্যাবলেট' },
  capsule: { en: 'capsule', hi: 'कैप्सूल', as: 'কেপচুল', bn: 'ক্যাপসুল' },
  sachet: { en: 'sachet', hi: 'पैकेट', as: 'পেকেট', bn: 'প্যাকেট' },
  syrup: { en: 'syrup', hi: 'सिरप', as: 'চিৰাপ', bn: 'সিরাপ' },
  inhaler: { en: 'inhaler', hi: 'पंप', as: 'ইনহেলাৰ', bn: 'ইনহেলার' },
  drops: { en: 'drops', hi: 'बूंदें', as: 'ড্ৰপ', bn: 'ড্রপ' },
  generic: { en: 'Check strip', hi: 'पत्ता देखें', as: 'ষ্ট্ৰিপ চাওক', bn: 'পাতা দেখুন' },
};

function detectFormCue(name: string, doseAmount = ''): MedicineVisualForm | null {
  const txt = `${name} ${doseAmount}`.toLowerCase();
  if (/\binhaler\b|\bpuff\b|\brotacap\b|\brespule\b/.test(txt)) return 'inhaler';
  if (/\bsyrup\b|\bsuspension\b|\btonic\b|\bml\b|\bspoon\b/.test(txt)) return 'syrup';
  if (/\bdrop\b|\bdrops\b/.test(txt)) return 'drops';
  if (/\bsachet\b|\bpacket\b|\bpowder\b/.test(txt)) return 'sachet';
  if (/\bcap\b|\bcapsule\b/.test(txt)) return 'capsule';
  return null;
}

export function getMedicineVisualAppearance(
  name: string,
  activeIngredient = '',
  doseAmount = ''
): MedicineVisualAppearance {
  const matches = matchCatalogMedicines(name, activeIngredient);
  const preferred =
    matches.find((m) => m.activeIngredients.length > 1 && m.visual) ||
    matches.find((m) => m.visual);

  const formCue = detectFormCue(name, doseAmount);

  if (preferred?.visual) {
    const resolvedForm = formCue || preferred.visual.form;
    const c1 = COLOR_WORDS[preferred.visual.colorKey] ?? COLOR_WORDS.white;
    const c2 = preferred.visual.secondaryColorKey
      ? COLOR_WORDS[preferred.visual.secondaryColorKey]
      : null;
    const formWord = FORM_WORDS[resolvedForm];

    const buildLabel = (lang: SupportedLanguage) =>
      c2
        ? `${c1[lang]} / ${c2[lang]} ${formWord[lang]}`
        : `${c1[lang]} ${formWord[lang]}`;

    return {
      form: resolvedForm,
      primaryColor: resolvedForm === 'inhaler' ? '#2563EB' : preferred.visual.primaryColor,
      secondaryColor: preferred.visual.secondaryColor,
      scored: resolvedForm === 'round' || resolvedForm === 'oval' ? preferred.visual.scored : false,
      label: {
        en: buildLabel('en'),
        hi: buildLabel('hi'),
        as: buildLabel('as'),
        bn: buildLabel('bn'),
      },
      matchedFromCatalog: true,
    };
  }

  const fallbackForm: MedicineVisualForm = formCue || 'generic';
  const fallbackWord = FORM_WORDS[fallbackForm];
  return {
    form: fallbackForm,
    primaryColor: '#E2E8F0',
    scored: false,
    label: {
      en: fallbackWord.en,
      hi: fallbackWord.hi,
      as: fallbackWord.as,
      bn: fallbackWord.bn,
    },
    matchedFromCatalog: false,
  };
}

export function getCatalogInfo() {
  return {
    version: safetyDataset.datasetVersion,
    count: safetyDataset.medicines.length,
    disclaimer: safetyDataset.disclaimer,
  };
}
