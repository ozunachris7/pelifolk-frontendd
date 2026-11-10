export type ExitType = 'sale' | 'death' | 'slaughter' | 'transfer' | 'theft' | 'other';
export interface ExitAnimal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export interface ExitRecord {
  id: string;
  animal: ExitAnimal;
  exit_type: ExitType;
  date: string;
  reason: string | null;
  recorded_by: string;
}
export interface ExitPage {
  items: ExitRecord[];
  total: number;
  offset: number;
  limit: number;
}
export interface ExitHistory {
  animal: ExitAnimal;
  items: ExitRecord[];
}
export interface ExitInput {
  animal_id: string;
  exit_type: ExitType;
  date: string;
  reason: string;
}
export const exitTypes: { value: ExitType; label: string }[] = [
  { value: 'sale', label: 'Venta' },
  { value: 'death', label: 'Muerte' },
  { value: 'slaughter', label: 'Sacrificio' },
  { value: 'transfer', label: 'Traspaso' },
  { value: 'theft', label: 'Robo' },
  { value: 'other', label: 'Otro' },
];
export const exitLabel = (value: string) =>
  value === 'active' ? 'Activo' : (exitTypes.find((t) => t.value === value)?.label ?? value);
export const animalLabel = (a: ExitAnimal) =>
  [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
