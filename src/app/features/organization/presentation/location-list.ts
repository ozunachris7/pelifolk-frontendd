import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { ManageOrganization } from '../application/manage-organization';
import { Location, LocationType, typeLabel } from '../domain/organization';
import { OrganizationNav } from './organization-nav';
@Component({
  selector: 'app-location-list',
  imports: [ReactiveFormsModule, LucideAngularModule, Modal, OrganizationNav],
  templateUrl: './location-list.html',
})
export class LocationList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly management = inject(ManageOrganization);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'locations:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'locations:write'),
  );
  protected readonly locations = signal<Location[]>([]);
  protected readonly types = signal<LocationType[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Location | null>(null);
  protected readonly formError = signal('');
  protected readonly catalogLoading = signal(false);
  protected readonly catalogReady = signal(false);
  protected readonly typeBusy = signal(false);
  protected readonly typeError = signal('');
  protected readonly search = signal('');
  protected readonly status = signal('active');
  protected readonly filtered = computed(() =>
    this.locations().filter(
      (location) =>
        location.name.toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase()) &&
        (this.status() === 'all' || location.active === (this.status() === 'active')),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(2000)],
    location_type_id: [0, [Validators.required, Validators.min(1)]],
    active: [true],
  });
  protected readonly typeName = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/\S/),
    Validators.maxLength(80),
  ]);
  protected readonly typeLabel = typeLabel;
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  private request = 0;
  private formRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.formRequest++;
  }
  protected async load() {
    if (!this.canRead()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const locations = await this.management.locations(this.session.user());
      if (request === this.request) this.locations.set(locations);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudieron cargar las ubicaciones.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected async openForm(location: Location | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(location);
    this.formError.set('');
    this.typeError.set('');
    this.typeName.reset();
    this.form.reset({
      name: location?.name ?? '',
      description: location?.description ?? '',
      location_type_id: location?.location_type_id ?? 0,
      active: location?.active ?? true,
    });
    this.formOpen.set(true);
    this.catalogLoading.set(true);
    this.catalogReady.set(false);
    const request = ++this.formRequest;
    try {
      const types = await this.management.locationTypes(this.session.user());
      if (request === this.formRequest) {
        this.types.set(types);
        this.catalogReady.set(true);
      }
    } catch (error) {
      if (request === this.formRequest)
        this.formError.set(
          apiError(
            error,
            'No se pudieron cargar los tipos. Cierra y vuelve a abrir el formulario.',
          ),
        );
    } finally {
      if (request === this.formRequest) this.catalogLoading.set(false);
    }
  }
  protected closeForm() {
    if (!this.busy() && !this.typeBusy()) {
      this.formRequest++;
      this.formOpen.set(false);
    }
  }
  protected async createType() {
    this.typeName.markAsTouched();
    if (this.typeName.invalid || this.typeBusy() || this.busy()) return;
    this.typeBusy.set(true);
    this.typeError.set('');
    try {
      const kind = await this.management.createType(this.session.user(), this.typeName.value);
      if (this.destroyed) return;
      this.types.update((types) => [...types, kind].sort((a, b) => a.name.localeCompare(b.name)));
      this.form.controls.location_type_id.setValue(kind.id);
      this.typeName.reset();
    } catch (error) {
      if (!this.destroyed)
        this.typeError.set(apiError(error, 'No se pudo registrar el tipo de ubicación.'));
    } finally {
      if (!this.destroyed) this.typeBusy.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || this.typeBusy() || !this.catalogReady()) return;
    this.busy.set(true);
    this.formError.set('');
    const values = this.form.getRawValue();
    try {
      const saved = await this.management.saveLocation(
        this.session.user(),
        { ...values, name: values.name.trim(), description: values.description.trim() || null },
        this.editing()?.id,
      );
      if (this.destroyed) return;
      this.locations.update((locations) =>
        [...locations.filter((location) => location.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.formOpen.set(false);
      this.success.set(this.editing() ? 'Ubicación actualizada.' : 'Ubicación registrada.');
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar la ubicación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
