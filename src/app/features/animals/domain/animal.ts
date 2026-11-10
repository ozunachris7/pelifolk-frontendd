export type Sex = 'female' | 'male';
export type Origin = 'born_in_herd' | 'purchased' | 'donated' | 'other';
export interface Breed {
  id: number;
  name: string;
}
export interface BreedShare {
  breed_id: number;
  percentage: number | string;
}
export interface Parent {
  id: string;
  name: string | null;
  siniiga: string | null;
}
export interface AnimalInput {
  name: string | null;
  siniiga: string | null;
  sex: Sex;
  birth_date: string | null;
  origin: Origin;
  mother_id: string | null;
  father_id: string | null;
  is_breeder: boolean;
  breeds: BreedShare[];
}
export interface Animal extends AnimalInput {
  current_location?: { id: string; name: string; active: boolean; since: string } | null;
  id: string;
  created_at: string;
  breeds: (BreedShare & { name: string })[];
  mother: Parent | null;
  father: Parent | null;
  status?: string;
  exit_date?: string | null;
  purity: 'pure' | 'crossbred' | null;
}
export interface AnimalPage {
  excluded_parent_ids?: string[];
  items: Animal[];
  total: number;
  offset: number;
  limit: number;
}
export interface AnimalQuery {
  q?: string;
  sex?: Sex | '';
  offset?: number;
  limit?: number;
  exclude_id?: string;
  parent_of?: string;
  active?: 'true' | 'false' | '';
}
export interface AnimalRepository {
  list(query: AnimalQuery): Promise<AnimalPage>;
  get(id: string): Promise<Animal>;
  save(input: AnimalInput, id?: string): Promise<Animal>;
  breeds(): Promise<Breed[]>;
  createBreed(name: string): Promise<Breed>;
  updateBreed(id: number, name: string): Promise<Breed>;
  deleteBreed(id: number): Promise<void>;
}
export const sexLabel = (sex: Sex) => (sex === 'female' ? 'Hembra' : 'Macho');
export const originLabel = (origin: Origin) =>
  ({ born_in_herd: 'Nacido en el hato', purchased: 'Comprado', donated: 'Donado', other: 'Otro' })[
    origin
  ];
export const animalLabel = (animal: Parent) =>
  [animal.name, animal.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
export const breedTotal = (shares: BreedShare[]) =>
  shares.reduce((sum, share) => sum + Math.round(Number(share.percentage) * 100), 0) / 100;
