import {
  AccessRepository,
  Actor,
  Role,
  RoleInput,
  User,
  UserChanges,
  UserInput,
  canEditRole,
  canDeleteRole,
  canGrant,
  canManageUser,
  hasPermission,
} from '../domain/access';

export class ManageAccess {
  constructor(private readonly repository: AccessRepository) {}

  users(actor: Actor | null, offset: number, limit: number): Promise<User[]> {
    this.require(actor, 'users:read');
    return this.repository.users(offset, limit);
  }

  roles(actor: Actor | null): Promise<Role[]> {
    this.require(actor, 'roles:read');
    return this.repository.roles();
  }

  permissions(actor: Actor | null): Promise<string[]> {
    this.require(actor, 'roles:read');
    return this.repository.permissions();
  }

  createUser(actor: Actor | null, input: UserInput, role: Role): Promise<User> {
    this.require(actor, 'users:write');
    if (input.role_id !== role.id || !canGrant(actor, role.permissions)) {
      throw new Error('No puedes asignar un rol con permisos superiores a los tuyos.');
    }
    return this.repository.createUser(input);
  }

  updateUser(actor: Actor | null, user: User, input: UserChanges, role?: Role): Promise<User> {
    if (!canManageUser(actor, user)) throw new Error('No tienes permiso para editar esta cuenta.');
    if (actor?.id === user.id && (input.role_id !== undefined || input.active === false)) {
      throw new Error('No puedes cambiar tu propio rol ni desactivar tu cuenta.');
    }
    if (
      input.role_id !== undefined &&
      (!role || role.id !== input.role_id || !canGrant(actor, role.permissions))
    ) {
      throw new Error('No puedes asignar un rol con permisos superiores a los tuyos.');
    }
    return this.repository.updateUser(user.id, input);
  }

  deactivateUser(actor: Actor | null, user: User): Promise<void> {
    if (!canManageUser(actor, user) || actor?.id === user.id) {
      throw new Error('No puedes desactivar esta cuenta.');
    }
    return this.repository.deactivateUser(user.id);
  }

  createRole(actor: Actor | null, input: RoleInput): Promise<Role> {
    this.require(actor, 'roles:write');
    if (!canGrant(actor, input.permissions))
      throw new Error('Solo puedes otorgar permisos que ya tienes.');
    return this.repository.createRole(input);
  }

  updateRole(actor: Actor | null, role: Role, input: RoleInput): Promise<Role> {
    if (!canEditRole(actor, role) || !canGrant(actor, input.permissions)) {
      throw new Error('No tienes permiso para modificar este rol.');
    }
    if (role.is_system && input.name !== role.name) {
      throw new Error('Los nombres de los roles iniciales no se pueden cambiar.');
    }
    return this.repository.updateRole(role.id, input);
  }

  deleteRole(actor: Actor | null, role: Role): Promise<void> {
    if (!canDeleteRole(actor, role)) throw new Error('Este rol no se puede eliminar.');
    return this.repository.deleteRole(role.id);
  }

  private require(actor: Actor | null, permission: string): void {
    if (!hasPermission(actor, permission))
      throw new Error('No tienes permiso para realizar esta acción.');
  }
}
