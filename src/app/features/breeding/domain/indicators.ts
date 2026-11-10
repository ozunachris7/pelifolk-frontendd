import { PhysicalAnimal } from '../../animals/domain/physical';
export interface DurationStat {
  count: number;
  total_days: number;
  average_days: string | null;
  min_days: number | null;
  max_days: number | null;
}
export interface PregnancyStat {
  matings: number;
  pregnant: number;
  not_pregnant: number;
  uncertain: number;
  no_diagnosis: number;
  diagnosed: number;
  percentage: string | null;
  unlinked_diagnoses: number;
  first_positive_delay: DurationStat;
}
export interface FollowupStat {
  total: number;
  live_births: number;
  stillbirths: number;
  unknown_birth_condition: number;
  missing_birth_date: number;
  too_young: number;
  unobservable: number;
  without_recorded_death: number;
  deaths: number;
  observable: number;
  percentage: string | null;
}
export interface IndicatorMetric {
  births: number;
  birth_intervals: DurationStat;
  pregnancy: PregnancyStat;
  followup: FollowupStat;
}
export interface IndicatorRow extends IndicatorMetric {
  animal: PhysicalAnimal;
}
export interface IndicatorContext {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  age_days: number;
}
export interface IndicatorPage extends IndicatorContext {
  items: IndicatorRow[];
  summary: IndicatorMetric;
  total: number;
  offset: number;
  limit: number;
}
export type IndicatorSection = 'birth_intervals' | 'matings' | 'offspring';
export interface IndicatorItem {
  previous_birth_id?: string;
  previous_date?: string;
  date?: string;
  days?: number;
  predecessor_outside_period?: boolean;
  result?: string;
  diagnosis_date?: string | null;
  first_positive_date?: string | null;
  first_positive_days?: number | null;
  animal?: PhysicalAnimal;
  birth_date?: string | null;
  born_alive?: boolean | null;
  target_date?: string | null;
  state?: string;
  exit_type?: string | null;
  exit_date?: string | null;
}
export interface IndicatorDetail extends IndicatorContext {
  parent: IndicatorRow;
  section: IndicatorSection;
  items: IndicatorItem[];
  total: number;
  offset: number;
  limit: number;
}
export const diagnosisLabel = (value: string | undefined) =>
  ({
    pregnant: 'Gestante',
    not_pregnant: 'Vacía',
    uncertain: 'Dudoso',
    no_diagnosis: 'Sin diagnóstico vinculado',
  })[value || ''] || 'Sin dato';
export const followupLabel = (value: string | undefined) =>
  ({
    without_recorded_death: 'Sin muerte registrada a la edad elegida',
    deaths: 'Muerte o sacrificio antes de la edad elegida',
    unobservable: 'Salida antes de la edad elegida: seguimiento incompleto',
    too_young: 'Aún no cumple la edad al corte',
    stillbirths: 'Sin vida al nacer',
    unknown_birth_condition: 'Condición al nacer desconocida',
    missing_birth_date: 'Sin fecha de nacimiento',
  })[value || ''] || 'Sin dato';
