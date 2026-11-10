import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Pencil, UserRound, Users, RefreshCw } from 'lucide-angular';
import { Session } from '../../../../../core/auth/session';
import { apiError } from '../../../../../core/http/api-error';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ManageAccess } from '../../../application/manage-access';
import {
  User,
  Role,
  UserChanges,
  canGrant,
  canManageUser,
  hasPermission,
} from '../../../domain/access';
import { roleLabel } from '../../access-labels';

@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, Modal],
  templateUrl: './user-list.html',
})
export class UserList implements OnInit {
  protected readonly session = inject(Session);
  private readonly management = inject(ManageAccess);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly users = signal<User[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly success = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = 25;
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  protected readonly deactivating = signal<User | null>(null);
  protected readonly roleLabel = roleLabel;
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  protected readonly userIcon = UserRound;
  protected readonly usersIcon = Users;
  protected readonly refreshIcon = RefreshCw;
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'users:read'));
  protected readonly canWrite = computed(() => hasPermission(this.session.user(), 'users:write'));
  protected readonly canReadRoles = computed(() =>
    hasPermission(this.session.user(), 'roles:read'),
  );
  protected readonly availableRoles = computed(() =>
    this.roles().filter((role) => canGrant(this.session.user(), role.permissions)),
  );
  protected readonly canCreate = computed(
    () => this.canWrite() && this.canReadRoles() && this.availableRoles().length > 0,
  );
  protected readonly fields: {
    key: 'name' | 'middle_name' | 'paternal_lastname' | 'maternal_lastname' | 'email' | 'phone';
    label: string;
    type: string;
    required: boolean;
    autocomplete: string;
    maxlength: number;
  }[] = [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      required: true,
      autocomplete: 'given-name',
      maxlength: 120,
    },
    {
      key: 'middle_name',
      label: 'Segundo nombre',
      type: 'text',
      required: false,
      autocomplete: 'additional-name',
      maxlength: 120,
    },
    {
      key: 'paternal_lastname',
      label: 'Apellido paterno',
      type: 'text',
      required: true,
      autocomplete: 'family-name',
      maxlength: 120,
    },
    {
      key: 'maternal_lastname',
      label: 'Apellido materno',
      type: 'text',
      required: true,
      autocomplete: 'off',
      maxlength: 120,
    },
    {
      key: 'email',
      label: 'Correo electrónico',
      type: 'email',
      required: true,
      autocomplete: 'off',
      maxlength: 190,
    },
    {
      key: 'phone',
      label: 'Teléfono',
      type: 'tel',
      required: false,
      autocomplete: 'tel',
      maxlength: 30,
    },
  ];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    middle_name: ['', Validators.maxLength(120)],
    paternal_lastname: [
      '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    ],
    maternal_lastname: [
      '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    phone: ['', Validators.maxLength(30)],
    role_id: ['', Validators.required],
    password: ['', [Validators.minLength(8), Validators.maxLength(128)]],
    active: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected canEdit(user: User): boolean {
    return canManageUser(this.session.user(), user);
  }
  protected isSelf(user: User): boolean {
    return user.id === this.session.user()?.id;
  }
  protected fullName(user: User): string {
    return [user.name, user.middle_name, user.paternal_lastname, user.maternal_lastname]
      .filter(Boolean)
      .join(' ');
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    try {
      const [users, roles] = await Promise.all([
        this.management.users(this.session.user(), this.page() * this.pageSize, this.pageSize),
        this.canReadRoles() ? this.management.roles(this.session.user()) : Promise.resolve([]),
      ]);
      this.users.set(users.filter((user) => user.id !== this.session.user()?.id));
      this.roles.set(roles);
    } catch (error) {
      this.error.set(apiError(error, 'No se pudieron cargar los usuarios.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected changePage(direction: number): void {
    if (this.loading() || this.busy()) return;
    this.page.update((page) => Math.max(0, page + direction));
    void this.load();
  }

  protected openCreate(): void {
    if (!this.canCreate() || this.busy()) return;
    this.editing.set(null);
    this.form.enable();
    this.form.reset({ active: true });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(128),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected openEdit(user: User): void {
    if (!this.canEdit(user) || this.busy()) return;
    this.editing.set(user);
    this.form.enable();
    this.form.reset({
      ...user,
      middle_name: user.middle_name ?? '',
      phone: user.phone ?? '',
      password: '',
    });
    this.form.controls.password.setValidators([Validators.minLength(8), Validators.maxLength(128)]);
    this.form.controls.password.updateValueAndValidity();
    if (this.isSelf(user) || !this.canReadRoles()) this.form.controls.role_id.disable();
    if (this.isSelf(user)) this.form.controls.active.disable();
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.form.reset();
    this.formError.set('');
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    for (const field of this.fields) {
      this.form.controls[field.key].setValue(this.form.controls[field.key].value.trim());
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Revisa los campos señalados.');
      return;
    }
    const values = this.form.getRawValue();
    const { password, active, ...identity } = values;
    const payload = {
      ...identity,
      middle_name: identity.middle_name || null,
      phone: identity.phone || null,
    };
    const previous = this.editing();
    const selectedRole = this.roles().find((role) => role.id === payload.role_id);
    this.busy.set(true);
    this.formError.set('');
    this.success.set('');
    try {
      let saved: User;
      if (previous) {
        const changes: UserChanges = { ...payload };
        if (payload.role_id === previous.role_id) delete changes.role_id;
        if (active !== previous.active) changes.active = active;
        if (password) changes.password = password;
        saved = await this.management.updateUser(
          this.session.user(),
          previous,
          changes,
          selectedRole,
        );
      } else {
        if (!selectedRole) throw new Error('Selecciona un rol disponible.');
        saved = await this.management.createUser(
          this.session.user(),
          { ...payload, password },
          selectedRole,
        );
      }
      this.session.updateIdentity(saved);
      this.formOpen.set(false);
      this.form.reset();
      if (previous && this.isSelf(previous) && password) {
        this.session.invalidate();
        await this.router.navigate(['/login'], {
          queryParams: { reason: 'password_changed' },
          replaceUrl: true,
        });
        return;
      }
      this.success.set(
        previous
          ? 'Usuario actualizado.'
          : 'Usuario creado. Ya puede iniciar sesión con su correo y contraseña.',
      );
      await this.load();
    } catch (error) {
      this.formError.set(apiError(error, 'No se pudo guardar el usuario.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected askDeactivate(user: User): void {
    if (!this.canEdit(user) || this.isSelf(user) || this.busy()) return;
    this.formError.set('');
    this.deactivating.set(user);
  }

  protected cancelDeactivate(): void {
    if (!this.busy()) {
      this.deactivating.set(null);
      this.formError.set('');
    }
  }

  protected async confirmDeactivate(): Promise<void> {
    const user = this.deactivating();
    if (!user || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.management.deactivateUser(this.session.user(), user);
      this.deactivating.set(null);
      this.success.set('Usuario desactivado. Su historial se conserva.');
      await this.load();
    } catch (error) {
      this.formError.set(apiError(error, 'No se pudo desactivar el usuario.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async reactivate(user: User): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.management.updateUser(this.session.user(), user, { active: true });
      this.success.set('Usuario activado.');
      await this.load();
    } catch (error) {
      this.error.set(apiError(error, 'No se pudo activar el usuario.'));
    } finally {
      this.busy.set(false);
    }
  }
}
