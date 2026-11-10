import { AnimalOption, Page } from './health';
export interface ReactionDose {
  id: string;
  product_id: string;
  product_name?: string;
  applied_at: string;
  dose_value: string;
  dose_unit_code: string;
  route_name: string;
  administered_by: string;
}
export interface Reaction {
  id: string;
  animal: AnimalOption;
  date: string;
  kind: 'suspected_allergy' | 'adverse_reaction';
  description: string;
  suspected_agent: string | null;
  product_id: string | null;
  product_name: string | null;
  dose: ReactionDose | null;
  recorded_by: string;
  status: 'open' | 'closed';
  closed_date: string | null;
  closure_notes: string | null;
  closed_by: string | null;
}
export const reactionKind = (kind: Reaction['kind']) =>
  kind === 'suspected_allergy' ? 'Sospecha de alergia' : 'Reacción adversa observada';
export type ReactionPage = Page<Reaction>;
