import { AnimalOption, Page } from './health';
export const incidentKinds = [
  { value: 'accident', label: 'Accidente' },
  { value: 'abortion', label: 'Aborto reportado' },
  { value: 'attack', label: 'Ataque' },
  { value: 'poisoning', label: 'Intoxicación reportada' },
  { value: 'disappearance', label: 'Desaparición' },
  { value: 'other', label: 'Otro incidente' },
] as const;
export type IncidentKind = (typeof incidentKinds)[number]['value'];
export type IncidentStatus = 'open' | 'in_progress' | 'closed';
export const incidentStatuses = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En seguimiento' },
  { value: 'closed', label: 'Cerrado' },
] as const;
export const incidentKind = (value: string) =>
  incidentKinds.find((k) => k.value === value)?.label || value;
export const incidentStatus = (value: string) =>
  incidentStatuses.find((k) => k.value === value)?.label || value;
export interface IncidentCase {
  id: string;
  reason: string;
  status: string;
  start_date: string;
}
export interface Incident {
  id: string;
  animal: AnimalOption;
  date: string;
  kind: IncidentKind;
  description: string;
  location: string | null;
  initial_actions: string | null;
  health_case: IncidentCase | null;
  status: IncidentStatus;
  version: number;
  recorded_by: string;
}
export interface IncidentFollowup {
  id: string;
  date: string;
  status: IncidentStatus;
  version: number;
  notes: string;
  recorded_by: string;
  health_case: IncidentCase | null;
}
export interface IncidentDetail {
  incident: Incident;
  last_followup_date: string | null;
  followups: Page<IncidentFollowup>;
}
