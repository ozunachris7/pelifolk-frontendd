import { PhysicalAnimal, PhysicalEvaluation, PhysicalRubric } from '../../animals/domain/physical';
export type AssessmentKind = 'maternal' | 'offspring';
export interface Assessment extends PhysicalEvaluation {
  kind: AssessmentKind;
  mother: PhysicalAnimal;
  father: PhysicalAnimal | null;
  birth_event_id: string;
  birth_date: string;
  birth_replaced: boolean;
}
export interface BirthOption {
  id: string;
  date: string;
  mother: PhysicalAnimal;
  offspring: { animal: PhysicalAnimal; alive_at_birth: boolean }[];
}
export interface AssessmentPage {
  items: Assessment[];
  total: number;
  offset: number;
  limit: number;
}
export interface BirthPage {
  items: BirthOption[];
  total: number;
  offset: number;
  limit: number;
}
export type AssessmentRubric = PhysicalRubric;
export const assessmentKind = (kind: AssessmentKind) =>
  kind === 'maternal' ? 'Habilidad materna' : 'Observaciones de cría';
export { physicalAnimalLabel } from '../../animals/domain/physical';
