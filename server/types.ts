export type SupportedLanguage = 'en' | 'hi' | 'as' | 'bn';

export type FoodTiming = 'before_food' | 'after_food' | 'with_food' | 'any';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type DoseSlot = 'morning' | 'afternoon' | 'night';

export interface MedicineExplanation {
  usedFor: string;
  howAndWhen: string;
  whatToAvoid: string;
  whenToCallDoctor: string;
}

export interface ExtractedMedicineInput {
  tempId?: string;
  name: string;
  activeIngredient?: string;
  strength: string;
  doseAmount: string;
  frequencyCode: string;
  slots: DoseSlot[];
  foodTiming: FoodTiming;
  durationDays: number;
  specialInstructions: string;
  confidence: ConfidenceLevel;
  unclearReason?: string;
}

export interface SafetyWarning {
  id: string;
  severity: 'high' | 'moderate' | 'unchecked';
  category: 'duplicate' | 'interaction' | 'allergy' | 'condition' | 'not_checked';
  title: string;
  description: string;
  action: string;
  medicinesInvolved: string[];
}

export interface JanAushadhiOption {
  genericLabel: string;
  janAushadhiPriceInr: number;
  brandedAvgPriceInr: number;
  packSize: string;
  savingsPercent: number;
}

export type MedicineVisualForm =
  | 'round'
  | 'oval'
  | 'capsule'
  | 'sachet'
  | 'syrup'
  | 'inhaler'
  | 'drops'
  | 'generic';

export interface MedicineVisualAppearance {
  form: MedicineVisualForm;
  primaryColor: string;
  secondaryColor?: string;
  scored?: boolean;
  label: Record<SupportedLanguage, string>;
  matchedFromCatalog: boolean;
}

export interface RefillStatus {
  durationDays: number;
  daysElapsed: number;
  daysRemaining: number;
  isLow: boolean;
  isEmpty: boolean;
}

export interface MedicineRecord {
  id: number;
  prescriptionId: number;
  name: string;
  activeIngredient: string;
  strength: string;
  doseAmount: string;
  frequencyCode: string;
  slots: DoseSlot[];
  foodTiming: FoodTiming;
  durationDays: number;
  specialInstructions: string;
  confidence: ConfidenceLevel;
  confirmedByUser: boolean;
  explanations: Partial<Record<SupportedLanguage, MedicineExplanation>>;
  safetyFlags: SafetyWarning[];
  janAushadhi?: JanAushadhiOption | null;
  visualAppearance?: MedicineVisualAppearance | null;
  refillStatus?: RefillStatus;
}

export interface DoseScheduleItem {
  doseId: number;
  medicineId: number;
  medicineName: string;
  strength: string;
  doseAmount: string;
  foodTiming: FoodTiming;
  specialInstructions: string;
  slot: DoseSlot;
  scheduledTime: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  actedAt: string | null;
  caregiverAlerted: boolean;
}

export interface CaregiverAlert {
  id: number;
  doseId: number;
  medicineName: string;
  slot: DoseSlot;
  scheduledFor: string;
  channel: 'whatsapp' | 'sms' | 'in_app';
  message: string;
  createdAt: string;
}

export interface PatientProfile {
  id: number;
  name: string;
  role: 'patient';
  language: SupportedLanguage;
  phone: string;
  conditions: string[];
  allergies: string[];
  streakDays: number;
}

export interface CaregiverProfile {
  id: number;
  patientId: number;
  name: string;
  relation: string;
  phone: string;
  channel: 'whatsapp' | 'sms' | 'in_app';
}

export interface WeeklySummaryDay {
  date: string;
  label: string;
  taken: number;
  total: number;
  rate: number;
}
