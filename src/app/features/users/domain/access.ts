export interface Actor {
  id: string;
  role_id: string;
  permissions: readonly string[];
}

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

export interface User extends Actor {
  name: string;
  middle_name: string | null;
  paternal_lastname: string;
  maternal_lastname: string;
  email: string;
  phone: string | null;
  active: boolean;
  role_name: string;
  permissions: string[];
}

export interface RoleInput {
  name: string;
  permissions: string[];
}

export interface UserInput {
  name: string;
  middle_name: string | null;
  paternal_lastname: string;
  maternal_lastname: string;
  email: string;
  phone: string | null;
  role_id: string;
  password: string;
}

export type UserChanges = Partial<
  Omit<UserInput, 'password'> & { password: string; active: boolean }
>;

export interface AccessRepository {
  users(offset: number, limit: number): Promise<User[]>;
  roles(): Promise<Role[]>;
  permissions(): Promise<string[]>;
  createUser(input: UserInput): Promise<User>;
  updateUser(id: string, input: UserChanges): Promise<User>;
  deactivateUser(id: string): Promise<void>;
  createRole(input: RoleInput): Promise<Role>;
  updateRole(id: string, input: RoleInput): Promise<Role>;
  deleteRole(id: string): Promise<void>;
}

export function hasPermission(actor: Actor | null, permission: string): boolean {
  return actor?.permissions.includes(permission) ?? false;
}

export function canGrant(actor: Actor | null, permissions: readonly string[]): boolean {
  return (
    actor !== null && permissions.every((permission) => actor.permissions.includes(permission))
  );
}

export function canManageUser(actor: Actor | null, user: User): boolean {
  return hasPermission(actor, 'users:write') && canGrant(actor, user.permissions);
}

export function canEditRole(actor: Actor | null, role: Role): boolean {
  return (
    hasPermission(actor, 'roles:write') &&
    actor?.role_id !== role.id &&
    !(role.is_system && role.name === 'owner') &&
    canGrant(actor, role.permissions)
  );
}

export function canDeleteRole(actor: Actor | null, role: Role): boolean {
  return canEditRole(actor, role) && !role.is_system;
}
