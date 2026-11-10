import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Plus,
  Pencil,
  ShieldCheck,
  LockKeyhole,
  RefreshCw,
} from 'lucide-angular';
import { Session } from '../../../../../core/auth/session';
import { apiError } from '../../../../../core/http/api-error';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ManageAccess } from '../../../application/manage-access';
import { Role, canEditRole, canDeleteRole, hasPermission } from '../../../domain/access';
import { roleLabel, permissionLabel } from '../../access-labels';
import { RolePermissionsModal } from '../../components/modals/role-permissions-modal';

@Component({
  selector: 'app-role-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    Modal,
    SlicePipe,
    RolePermissionsModal,
  ],
  templateUrl: './role-list.html',
})
export class RoleList implements OnInit {
  private readonly session = inject(Session);
  private readonly management = inject(ManageAccess);
  private readonly fb = inject(FormBuilder);
  protected readonly roles = signal<Role[]>([]);
  protected readonly permissions = signal<string[]>([]);
  protected readonly selectedPermissions = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Role | null>(null);
  protected readonly deleting = signal<Role | null>(null);
  protected readonly viewingPermissions = signal<Role | null>(null);
  protected readonly roleLabel = roleLabel;
  protected readonly permissionLabel = permissionLabel;
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  protected readonly shieldIcon = ShieldCheck;
  protected readonly lockIcon = LockKeyhole;
  protected readonly refreshIcon = RefreshCw;
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'roles:read'));
  protected readonly canWrite = computed(() => hasPermission(this.session.user(), 'roles:write'));
  protected readonly canReadUsers = computed(() =>
    hasPermission(this.session.user(), 'users:read'),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]{1,59}$/)]],
  });

  ngOnInit(): void {
    void this.load();
  }
  protected canEdit(role: Role): boolean {
    return canEditRole(this.session.user(), role);
  }
  protected canDelete(role: Role): boolean {
    return canDeleteRole(this.session.user(), role);
  }
  protected canGrant(permission: string): boolean {
    return hasPermission(this.session.user(), permission);
  }
  protected isOwnRole(role: Role): boolean {
    return role.id === this.session.user()?.role_id;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    try {
      const [roles, permissions] = await Promise.all([
        this.management.roles(this.session.user()),
        this.management.permissions(this.session.user()),
      ]);
      this.roles.set(roles);
      this.permissions.set(permissions);
    } catch (error) {
      this.error.set(apiError(error, 'No se pudieron cargar los roles.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreate(): void {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(null);
    this.form.enable();
    this.form.reset();
    this.selectedPermissions.set([]);
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected openEdit(role: Role): void {
    if (!this.canEdit(role) || this.busy()) return;
    this.editing.set(role);
    this.form.enable();
    this.form.reset({ name: role.name });
    if (role.is_system) this.form.controls.name.disable();
    this.selectedPermissions.set([...role.permissions]);
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected togglePermission(permission: string, event: Event): void {
    if (!this.canGrant(permission) || this.busy()) return;
    const checked = (event.target as HTMLInputElement).checked;
    if (
      permission.startsWith('health:') &&
      permission !== 'health:read' &&
      checked &&
      !this.canGrant('health:read')
    )
      return;
    if (permission === 'health:read' && !checked) {
      this.selectedPermissions.update((values) => values.filter((p) => !p.startsWith('health:')));
      return;
    }
    if (permission.startsWith('health:') && checked)
      this.selectedPermissions.update((values) => [...new Set([...values, 'health:read'])]);
    this.selectedPermissions.update((values) =>
      checked
        ? [...new Set([...values, permission])]
        : values.filter((value) => value !== permission),
    );
  }

  protected closeForm(): void {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.form.reset();
    this.selectedPermissions.set([]);
    this.formError.set('');
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.form.controls.name.setValue(this.form.controls.name.value.trim().toLowerCase());
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Revisa el nombre del rol.');
      return;
    }
    const input = { name: this.form.getRawValue().name, permissions: this.selectedPermissions() };
    const role = this.editing();
    this.busy.set(true);
    this.formError.set('');
    this.success.set('');
    try {
      if (role) await this.management.updateRole(this.session.user(), role, input);
      else await this.management.createRole(this.session.user(), input);
      this.formOpen.set(false);
      this.form.reset();
      this.success.set(
        role ? 'Rol y permisos actualizados.' : 'Rol creado. Ya puedes asignarlo a los usuarios.',
      );
      await this.load();
    } catch (error) {
      this.formError.set(apiError(error, 'No se pudo guardar el rol.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected askDelete(role: Role): void {
    if (!this.canDelete(role) || this.busy()) return;
    this.formError.set('');
    this.deleting.set(role);
  }

  protected cancelDelete(): void {
    if (!this.busy()) {
      this.deleting.set(null);
      this.formError.set('');
    }
  }

  protected async confirmDelete(): Promise<void> {
    const role = this.deleting();
    if (!role || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.management.deleteRole(this.session.user(), role);
      this.deleting.set(null);
      this.success.set('Rol eliminado.');
      await this.load();
    } catch (error) {
      this.formError.set(apiError(error, 'No se pudo eliminar el rol.'));
    } finally {
      this.busy.set(false);
    }
  }
}
