export interface AnimalOption {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export type CaseStatus = 'open' | 'under_treatment' | 'closed';
export interface LinkedCase {
  id: string;
  reason: string;
  status: CaseStatus;
  start_date: string;
}
export interface Observation {
  id: string;
  animal: AnimalOption;
  date: string;
  observation: string;
  health_case?: LinkedCase | null;
  recorded_by: string;
}
export interface HealthCase {
  id: string;
  animal: AnimalOption;
  reason: string;
  status: CaseStatus;
  start_date: string;
  closed_date: string | null;
  notes: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export interface CaseActivity {
  date: string;
  recorded_by: string;
  action: string;
  previous_status: CaseStatus | null;
  status: CaseStatus;
  closed_date: string | null;
}
export interface CaseDetail {
  observations?: Observation[];
  case: HealthCase;
  activity: CaseActivity[];
  diagnoses: Diagnosis[];
  treatments: Treatment[];
  followups?: Followup[];
}
export interface HealthHistory {
  animal: AnimalOption;
  observations: Observation[];
  diagnoses: Diagnosis[];
  treatments: Treatment[];
  followups?: Followup[];
  cases: HealthCase[];
}
export const animalLabel = (a: AnimalOption) =>
  [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
export const statusLabel = (s: CaseStatus) =>
  ({ open: 'Abierto', under_treatment: 'En tratamiento', closed: 'Cerrado' })[s];

export type Severity = 'mild' | 'moderate' | 'severe' | 'critical';
export interface Diagnosis {
  id: string;
  health_case_id: string;
  animal: AnimalOption;
  date: string;
  diagnosis: string;
  severity: Severity;
  recorded_by: string;
}
export const severityLabel = (s: Severity) =>
  ({ mild: 'Leve', moderate: 'Moderada', severe: 'Grave', critical: 'Crítica' })[s];

export interface CatalogItem {
  id: number;
  name: string;
}
export interface Unit {
  id: number;
  code: string;
}
export interface TreatmentCatalogs {
  product_types: CatalogItem[];
  units: Unit[];
  routes: CatalogItem[];
}
export interface Ingredient extends CatalogItem { product_count: number; }
export interface ProductPrice { effective_from: string; cost: string; }
export interface ProductInput {
  initial_price?: ProductPrice;
  ingredient_ids?: number[];
  name: string;
  product_type_id: number;
  unit_id: number;
  withdrawal_days: number;
  active: boolean;
}
export interface Product extends ProductInput {
  current_price?: ProductPrice | null;
  ingredients?: CatalogItem[];
  id: string;
  product_type_name: string;
  unit_code: string;
}
export interface TreatmentInput {
  product_id: string;
  start_date: string;
  dose_value: number;
  dose_unit_id: number;
  route_id: number;
  frequency_hours: number | null;
  duration_days: number;
}
export interface Treatment extends TreatmentInput {
  id: string;
  health_case_id: string | null;
  program_id: string | null;
  program_name: string | null;
  animal: AnimalOption;
  product: Product;
  end_date: string;
  last_day: string;
  dose_unit_code: string;
  route_name: string;
  recorded_by: string;
}
const LABELS: Record<string, string> = {
  medicine: 'Medicamento',
  vaccine: 'Vacuna',
  antiparasitic: 'Antiparasitario',
  supplement: 'Suplemento',
  other: 'Otro',
  oral: 'Oral',
  intramuscular: 'Intramuscular',
  subcutaneous: 'Subcutánea',
  topical: 'Tópica',
  intravenous: 'Intravenosa',
  tablet: 'Tableta',
  dose: 'Dosis',
};
export const catalogLabel = (code: string) => LABELS[code] ?? code;
export function lastTreatmentDay(start: string, duration: number) {
  if (!start || !Number.isInteger(duration) || duration < 1 || duration > 3650) return null;
  const day = new Date(start + 'T00:00:00Z');
  if (!Number.isFinite(day.getTime())) return null;
  day.setUTCDate(day.getUTCDate() + duration - 1);
  return day.toISOString().slice(0, 10);
}

export interface HealthProgramInput {
  name: string;
  product_id: string;
  interval_days: number;
  minimum_age_days: number;
  sex: 'male' | 'female' | null;
  notice_days: number;
  active: boolean;
}
export interface HealthProgram extends Omit<HealthProgramInput, 'product_id'> {
  id: string;
  product: Product;
}
export type NoticeStatus = 'overdue' | 'due' | 'upcoming' | 'scheduled' | 'missing_birth_date';
export interface ProgramNotice {
  animal: AnimalOption;
  birth_date: string | null;
  last_application: string | null;
  due_date: string | null;
  days_remaining: number | null;
  status: NoticeStatus;
  can_apply: boolean;
}
export interface ProgramSchedule extends Page<ProgramNotice> {
  program: HealthProgram;
  as_of: string;
}
export type ProgramApplication = Omit<TreatmentInput, 'product_id'> & { animal_id: string };
export const noticeLabel = (status: NoticeStatus) =>
  ({
    overdue: 'Vencida',
    due: 'Para hoy',
    upcoming: 'Próxima',
    scheduled: 'Programada',
    missing_birth_date: 'Falta nacimiento',
  })[status];

export interface Followup {
  id: string;
  health_case_id: string;
  animal: AnimalOption;
  date: string;
  evolution: 'improved' | 'unchanged' | 'worsened' | 'recovered';
  treatment_result: 'not_assessed' | 'effective' | 'partially_effective' | 'not_effective';
  notes: string;
  next_review_date: string | null;
  recorded_by: string;
  created_at: string;
}
export const evolutionLabel = (v: Followup['evolution']) =>
  ({ improved: 'Mejoró', unchanged: 'Sin cambios', worsened: 'Empeoró', recovered: 'Recuperado' })[
    v
  ];
export const resultLabel = (v: Followup['treatment_result']) =>
  ({
    not_assessed: 'Aún no evaluado',
    effective: 'Efectivo',
    partially_effective: 'Parcialmente efectivo',
    not_effective: 'Sin efecto observado',
  })[v];
