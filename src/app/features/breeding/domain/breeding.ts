export type Kind = 'mating' | 'pregnancy' | 'birth';
export interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
  sex: string;
}
export interface Offspring {
  animal: Animal;
  alive: boolean;
  birth_weight_kg: string | null;
}
export interface BreedingEvent {
  id: string;
  kind: Kind;
  animal: Animal;
  date: string;
  notes: string | null;
  recorded_by: string;
  male: Animal | null;
  kinship?: Kinship | null;
  result: string | null;
  mating_event_id: string | null;
  birth_type: string | null;
  offspring: Offspring[];
}
export interface EventPage {
  items: BreedingEvent[];
  total: number;
  offset: number;
  limit: number;
}
export interface BirthType {
  id: number;
  name: string;
}
export interface History {
  animal: Animal;
  items: BreedingEvent[];
}
export const animalLabel = (a: Animal) =>
  [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
export const kindLabel = (k: Kind) =>
  ({ mating: 'Monta', pregnancy: 'Diagnóstico de gestación', birth: 'Parto' })[k];
export const resultLabel = (value: string) =>
  (
    ({
      pregnant: 'Gestante',
      not_pregnant: 'Vacía',
      uncertain: 'Dudosa',
      natural: 'Natural',
      assisted: 'Asistido',
      cesarean: 'Cesárea',
      other: 'Otro',
    }) as Record<string, string>
  )[value] ?? value;

export interface Kinship {
  female: Animal;
  male: Animal;
  depth: number;
  status: 'related' | 'no_relationship_found' | 'insufficient_data';
  lineage_complete: boolean;
  invalid_lineage: boolean;
  missing_female: string[];
  missing_male: string[];
  matches: {
    kind: 'direct_ancestor' | 'shared_parent' | 'shared_grandparent' | 'parent_grandparent';
    ancestor: Animal;
    female_paths: string[];
    male_paths: string[];
  }[];
}
