export interface NamedInput {
  name: string;
  description: string | null;
  active: boolean;
}
export interface LocationType {
  id: number;
  name: string;
}
export interface LocationInput extends NamedInput {
  location_type_id: number;
}
export interface Location extends LocationInput {
  id: string;
  location_type_name: string;
}
export interface Group extends NamedInput {
  id: string;
  member_count: number;
}
export interface Membership {
  group_id: string;
  group_name: string;
  animal_id: string;
  animal_name: string | null;
  siniiga: string | null;
  start_date: string;
  end_date: string | null;
}
export interface MembershipPage {
  items: Membership[];
  total: number;
  offset: number;
  limit: number;
}
export interface AnimalOption {
  id: string;
  name: string | null;
  siniiga: string | null;
  group_id: string | null;
  group_name: string | null;
}
export interface AnimalOptionPage {
  items: AnimalOption[];
  total: number;
}
export interface AssignmentInput {
  animal_ids: string[];
  effective_date: string;
  move_existing: boolean;
}
export interface OrganizationRepository {
  locations(): Promise<Location[]>;
  locationTypes(): Promise<LocationType[]>;
  createType(name: string): Promise<LocationType>;
  saveLocation(input: LocationInput, id?: string): Promise<Location>;
  groups(): Promise<Group[]>;
  group(id: string): Promise<Group>;
  saveGroup(input: NamedInput, id?: string): Promise<Group>;
  memberships(id: string, current: boolean, offset: number, limit: number): Promise<MembershipPage>;
  animalOptions(q: string): Promise<AnimalOptionPage>;
  assign(id: string, input: AssignmentInput): Promise<Membership[]>;
  remove(groupId: string, animalId: string, effectiveDate: string): Promise<Membership>;
}
export const typeLabel = (name: string) =>
  ({ corral: 'Corral', pasture: 'Potrero', barn: 'Establo', other: 'Otro' })[name] ?? name;
export const todayDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const optionLabel = (animal: AnimalOption) =>
  [animal.name, animal.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
