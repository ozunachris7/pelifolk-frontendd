import { AnimalInput, AnimalQuery, AnimalRepository, breedTotal } from '../domain/animal';
import { Actor, hasPermission } from '../../users/domain/access';

export class ManageAnimals {
  constructor(private readonly repository: AnimalRepository) {}
  list(actor: Actor | null, query: AnimalQuery) {
    this.require(actor, 'animals:read');
    return this.repository.list(query);
  }
  get(actor: Actor | null, id: string) {
    this.require(actor, 'animals:read');
    return this.repository.get(id);
  }
  breeds(actor: Actor | null) {
    this.require(actor, 'animals:read');
    return this.repository.breeds();
  }
  createBreed(actor: Actor | null, name: string) {
    this.require(actor, 'animals:write');
    return this.repository.createBreed(name.trim());
  }
  updateBreed(actor: Actor | null, id: number, name: string) {
    this.require(actor, 'animals:write');
    return this.repository.updateBreed(id, name.trim());
  }
  deleteBreed(actor: Actor | null, id: number) {
    this.require(actor, 'animals:write');
    return this.repository.deleteBreed(id);
  }
  save(actor: Actor | null, input: AnimalInput, id?: string) {
    this.require(actor, 'animals:write');
    if (!input.name?.trim() && !input.siniiga?.trim())
      throw new Error('Ingresa el nombre o el SINIIGA del animal.');
    if (input.breeds.length && breedTotal(input.breeds) !== 100)
      throw new Error('Los porcentajes de raza deben sumar 100 %.');
    if (new Set(input.breeds.map((b) => b.breed_id)).size !== input.breeds.length)
      throw new Error('Selecciona cada raza una sola vez.');
    if (id && (input.mother_id === id || input.father_id === id))
      throw new Error('El animal no puede ser su propio padre o madre.');
    return this.repository.save(input, id);
  }
  private require(actor: Actor | null, permission: string) {
    if (!hasPermission(actor, permission))
      throw new Error('No tienes permiso para realizar esta acción.');
  }
}
