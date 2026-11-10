import { Animal } from './animal';
export interface Ancestor {
  animal: Animal;
  mother: Ancestor | null;
  father: Ancestor | null;
}
export interface Family {
  as_of: string;
  tree: Ancestor;
  children: Animal[];
  total_children: number;
  female_children: number;
  male_children: number;
  offset: number;
  limit: number;
}
