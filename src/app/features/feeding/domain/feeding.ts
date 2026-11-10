export interface Feed {
  id: string;
  name: string;
  unit_id: number;
  unit_code: string;
  current_unit_cost?: string | null;
  current_price_from?: string | null;
}
export interface Unit {
  id: number;
  code: string;
}
export interface Price {
  effective_from: string;
  unit_cost: string;
}
export interface Target {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export interface Consumption {
  id: string;
  animal: Target | null;
  group: Target | null;
  feed: Feed;
  date: string;
  quantity: string;
  unit_cost: string | null;
  price_from: string | null;
  cost: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export interface ConsumptionPage extends Page<Consumption> {
  total_cost: string;
  unpriced_count: number;
}
export interface ConsumptionInput {
  feed_id: string;
  animal_id: string | null;
  group_id: string | null;
  date: string;
  quantity: string;
}
export type TargetKind = "animal" | "group";
export const unitLabel = (code: string) =>
  (
    ({
      kg: "kg",
      lb: "lb",
      bag: "saco",
      bale: "paca",
      tablet: "tableta",
      dose: "dosis",
    }) as Record<string, string>
  )[code] ?? code;
export const targetLabel = (target: Target) =>
  [target.name, target.siniiga].filter(Boolean).join(" · ") ||
  "Sin identificación";
