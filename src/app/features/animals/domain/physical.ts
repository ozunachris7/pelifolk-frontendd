export interface PhysicalAnimal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export interface Criterion {
  code: string;
  label: string;
  description: string;
}
export interface PhysicalRubric {
  version: string;
  scoring: 'descriptive';
  criteria: Criterion[];
}
export interface PhysicalEvaluation {
  id: string;
  animal: PhysicalAnimal;
  date: string;
  evaluated_by: string;
  recorded_by: string;
  rubric_version: string;
  findings: (Criterion & { observation: string | null })[];
  notes: string | null;
}
export interface PhysicalPage {
  items: PhysicalEvaluation[];
  total: number;
  offset: number;
  limit: number;
}
export const physicalAnimalLabel = (a: PhysicalAnimal) =>
  [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin nombre / SINIIGA';
