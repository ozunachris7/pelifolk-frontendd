import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Pencil, PawPrint } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { ManageOrganization } from '../application/manage-organization';
import { Group } from '../domain/organization';
import { OrganizationNav } from './organization-nav';
@Component({
  selector: 'app-group-list',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, Modal, OrganizationNav],
  templateUrl: './group-list.html',
})
export class GroupList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly management = inject(ManageOrganization);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'groups:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'groups:write'),
  );
  protected readonly groups = signal<Group[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Group | null>(null);
  protected readonly formError = signal('');
  protected readonly search = signal('');
  protected readonly status = signal('active');
  protected readonly filtered = computed(() =>
    this.groups().filter(
      (group) =>
        group.name.toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase()) &&
        (this.status() === 'all' || group.active === (this.status() === 'active')),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(2000)],
    active: [true],
  });
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  protected readonly animalsIcon = PawPrint;
  private request = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async load() {
    if (!this.canRead()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const groups = await this.management.groups(this.session.user());
      if (request === this.request) this.groups.set(groups);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudieron cargar los lotes.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected openForm(group: Group | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(group);
    this.formError.set('');
    this.form.reset({
      name: group?.name ?? '',
      description: group?.description ?? '',
      active: group?.active ?? true,
    });
    this.formOpen.set(true);
  }
  protected closeForm() {
    if (!this.busy()) this.formOpen.set(false);
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    const values = this.form.getRawValue();
    try {
      const saved = await this.management.saveGroup(
        this.session.user(),
        { ...values, name: values.name.trim(), description: values.description.trim() || null },
        this.editing()?.id,
      );
      if (this.destroyed) return;
      this.groups.update((groups) =>
        [...groups.filter((group) => group.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.formOpen.set(false);
      this.success.set(this.editing() ? 'Lote actualizado.' : 'Lote registrado.');
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar el lote.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
