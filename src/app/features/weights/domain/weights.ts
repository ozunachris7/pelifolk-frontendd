export interface AnimalOption {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export interface Weight {
  is_weaning?: boolean;
  id: string;
  animal: AnimalOption;
  date: string;
  weight_kg: string;
  notes: string | null;
  recorded_by: string;
}
export interface WeightPage {
  items: Weight[];
  total: number;
  offset: number;
  limit: number;
}
export interface WeightHistory {
  animal: AnimalOption;
  items: Weight[];
}
export interface WeightInput {
  animal_id: string;
  date: string;
  weight_kg: number;
  notes: string | null;
}
export const animalLabel = (animal: AnimalOption) =>
  [animal.name, animal.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
export const dayNumber = (date: string) => Date.parse(date + 'T00:00:00Z') / 86400000;
export function measurements(items: Weight[]) {
  return items.map((weight, index) => {
    const previous = items[index - 1];
    const days = previous ? dayNumber(weight.date) - dayNumber(previous.date) : 0;
    const gain = previous ? Number(weight.weight_kg) - Number(previous.weight_kg) : null;
    return { ...weight, gain, days, daily: gain !== null && days > 0 ? gain / days : null };
  });
}
export function plot(items: Weight[]) {
  if (!items.length) return null;
  const days = items.map((w) => dayNumber(w.date));
  const values = items.map((w) => Number(w.weight_kg));
  const min = Math.max(
    0,
    Math.min(...values) - Math.max(2, (Math.max(...values) - Math.min(...values)) * 0.15),
  );
  const max = Math.max(...values) + Math.max(2, (Math.max(...values) - Math.min(...values)) * 0.15);
  const span = days[days.length - 1] - days[0];
  const points = items.map((w, i) => ({
    weight: w,
    x: span ? 64 + ((days[i] - days[0]) / span) * 612 : 370,
    y: 206 - ((values[i] - min) / (max - min)) * 178,
  }));
  return { points, path: points.map((p) => `${p.x},${p.y}`).join(' '), min, max };
}
