import { Actor, hasPermission } from '../../users/domain/access';
import {
  AssignmentInput,
  LocationInput,
  NamedInput,
  OrganizationRepository,
  todayDate,
} from '../domain/organization';
export class ManageOrganization {
  constructor(private readonly repository: OrganizationRepository) {}
  locations(actor: Actor | null) {
    this.require(actor, 'locations:read');
    return this.repository.locations();
  }
  locationTypes(actor: Actor | null) {
    this.require(actor, 'locations:read');
    return this.repository.locationTypes();
  }
  createType(actor: Actor | null, name: string) {
    this.require(actor, 'locations:write');
    return this.repository.createType(name.trim());
  }
  saveLocation(actor: Actor | null, input: LocationInput, id?: string) {
    this.require(actor, 'locations:write');
    return this.repository.saveLocation(input, id);
  }
  groups(actor: Actor | null) {
    this.require(actor, 'groups:read');
    return this.repository.groups();
  }
  group(actor: Actor | null, id: string) {
    this.require(actor, 'groups:read');
    return this.repository.group(id);
  }
  saveGroup(actor: Actor | null, input: NamedInput, id?: string) {
    this.require(actor, 'groups:write');
    return this.repository.saveGroup(input, id);
  }
  memberships(actor: Actor | null, id: string, current: boolean, offset: number, limit: number) {
    this.require(actor, 'groups:read');
    return this.repository.memberships(id, current, offset, limit);
  }
  animalOptions(actor: Actor | null, q: string) {
    this.require(actor, 'groups:write');
    return this.repository.animalOptions(q.trim());
  }
  assign(actor: Actor | null, id: string, input: AssignmentInput) {
    this.require(actor, 'groups:write');
    this.checkDate(input.effective_date);
    if (!input.animal_ids.length) throw new Error('Selecciona al menos un animal.');
    return this.repository.assign(id, input);
  }
  remove(actor: Actor | null, groupId: string, animalId: string, effectiveDate: string) {
    this.require(actor, 'groups:write');
    this.checkDate(effectiveDate);
    return this.repository.remove(groupId, animalId, effectiveDate);
  }
  private checkDate(date: string) {
    if (!date || date > todayDate())
      throw new Error('Ingresa una fecha de movimiento que no sea futura.');
  }
  private require(actor: Actor | null, permission: string) {
    if (!hasPermission(actor, permission))
      throw new Error('No tienes permiso para realizar esta acción.');
  }
}
