export interface ChildHealthCounts {
  total_cases: number;
  open_cases: number;
  under_treatment_cases: number;
  closed_cases: number;
}
export interface ParentHealthCounts extends ChildHealthCounts {
  offspring_with_cases: number;
  offspring_without_cases: number;
}
export interface OffspringCase {
  id: string;
  reason: string;
  status: 'open' | 'under_treatment' | 'closed';
  start_date: string;
  closed_date: string | null;
}
export interface OffspringCasePage {
  items: OffspringCase[];
  total: number;
  offset: number;
  limit: number;
  as_of: string;
  date_from: string | null;
  date_to: string | null;
}
export const offspringCaseStatus = (value: OffspringCase['status']) =>
  ({ open: 'Abierto', under_treatment: 'En tratamiento', closed: 'Cerrado' })[value];
