import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { OrganizationNav } from './organization-nav';
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface Place {
  id: string;
  name: string;
  active: boolean;
  since: string;
}
interface Position {
  animal: Animal;
  exited: boolean;
  current_location: Place | null;
  last_known_location: Place | null;
}
interface Page {
  as_of: string;
  items: Position[];
  total: number;
  offset: number;
  limit: number;
}
interface Movement {
  id: string;
  date: string;
  from_location: Place | null;
  to_location: Place;
  reason: string | null;
  event_type_id: number;
  recorded_by: string;
}
interface History extends Position {
  as_of: string;
  items: Movement[];
  total: number;
  offset: number;
  limit: number;
}
interface Location {
  id: string;
  name: string;
  active: boolean;
}
@Component({
  selector: 'app-movements',
  imports: [DatePipe, ReactiveFormsModule, Modal, OrganizationNav],
  templateUrl: './movements.html',
})
export class Movements implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private catalogRequest = 0;
  private historyRequest = 0;
  private applied = { q: '', status: 'active', location_id: '' };
  protected readonly allowed = !!this.session.user()?.permissions.includes('locations:read');
  protected readonly canWrite =
    this.allowed && !!this.session.user()?.permissions.includes('locations:write');
  protected readonly page = signal<Page>({ as_of: '', items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly locations = signal<Location[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal('');
  protected readonly filters = this.fb.nonNullable.group(this.applied);
  protected readonly selected = signal<Position | null>(null);
  protected readonly busy = signal(false);
  protected readonly formError = signal('');
  protected readonly form = this.fb.nonNullable.group({
    location_id: ['', Validators.required],
    date: ['', Validators.required],
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)]],
  });
  protected readonly historyAnimal = signal<Animal | null>(null);
  protected readonly history = signal<History | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected label(a: Animal) {
    return [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  }
  constructor() {
    if (this.allowed) {
      void this.loadCatalog();
      void this.load();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.catalogRequest++;
    this.historyRequest++;
  }
  protected search() {
    this.applied = { ...this.filters.getRawValue(), q: this.filters.controls.q.value.trim() };
    void this.load();
  }
  protected async loadCatalog() {
    const request = ++this.catalogRequest;
    this.catalogLoading.set(true);
    this.catalogError.set('');
    try {
      const locations = await firstValueFrom(
        this.http.get<Location[]>(`${this.api}/locations`).pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.catalogRequest) this.locations.set(locations);
    } catch (e) {
      if (!this.destroyed && request === this.catalogRequest)
        this.catalogError.set(apiError(e, 'No se pudieron cargar las ubicaciones.'));
    } finally {
      if (!this.destroyed && request === this.catalogRequest) this.catalogLoading.set(false);
    }
  }
  protected async load(offset = 0) {
    if (!this.allowed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const params = Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/locations/animal-positions`, {
            params: { ...params, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudieron consultar las ubicaciones de los animales.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected open(p: Position) {
    if (!this.canWrite || p.exited) return;
    this.selected.set(p);
    this.form.reset({ location_id: '', date: this.today, reason: '' });
    this.formError.set('');
    void this.loadCatalog();
  }
  protected close() {
    if (!this.busy()) this.selected.set(null);
  }
  protected async save() {
    this.form.markAllAsTouched();
    const p = this.selected();
    if (!p || this.form.invalid || this.busy() || this.catalogLoading() || this.catalogError())
      return;
    const f = this.form.getRawValue();
    if (f.date > this.today) {
      this.formError.set('La fecha no puede ser futura.');
      return;
    }
    if (p.last_known_location && f.date <= p.last_known_location.since) {
      this.formError.set('La fecha debe ser posterior al último registro de ubicación.');
      return;
    }
    if (f.location_id === p.current_location?.id) {
      this.formError.set('Selecciona una ubicación distinta de la actual.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      await firstValueFrom(
        this.http
          .post(`${this.api}/locations/movements`, {
            ...f,
            animal_id: p.animal.id,
            reason: f.reason.trim(),
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.selected.set(null);
        this.success.set('Ubicación del animal registrada.');
        void this.load();
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo registrar el traslado.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected openHistory(a: Animal) {
    this.historyAnimal.set(a);
    void this.loadHistory();
  }
  protected closeHistory() {
    this.historyRequest++;
    this.historyAnimal.set(null);
    this.history.set(null);
    this.historyLoading.set(false);
  }
  protected async loadHistory(offset = 0) {
    const a = this.historyAnimal();
    if (!a) return;
    const request = ++this.historyRequest;
    this.history.set(null);
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const h = await firstValueFrom(
        this.http
          .get<History>(`${this.api}/locations/animals/${a.id}/history`, {
            params: { offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.historyRequest) this.history.set(h);
    } catch (e) {
      if (!this.destroyed && request === this.historyRequest)
        this.historyError.set(apiError(e, 'No se pudo cargar el historial de ubicaciones.'));
    } finally {
      if (!this.destroyed && request === this.historyRequest) this.historyLoading.set(false);
    }
  }
}
