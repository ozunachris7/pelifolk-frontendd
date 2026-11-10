import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus, Eye } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { HealthNav } from './health-nav';
import { HealthRepository } from '../infrastructure/health-repository';
import { AnimalOption, Page, animalLabel } from '../domain/health';
import {
  Incident,
  IncidentCase,
  IncidentDetail,
  incidentKinds,
  incidentStatuses,
  incidentKind,
  incidentStatus,
} from '../domain/incident';
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-incident-list',
  imports: [
    DetailPage,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    HealthNav,
    Modal,
  ],
  providers: [HealthRepository],
  templateUrl: './incident-list.html',
})
export class IncidentList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly repo = inject(HealthRepository);
  private readonly session = inject(Session);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(
    () => !!this.session.user()?.permissions.includes('health:read'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && !!this.session.user()?.permissions.includes('health:incidents:write'),
  );
  protected readonly plus = Plus;
  protected readonly eye = Eye;
  protected readonly kinds = incidentKinds;
  protected readonly statuses = incidentStatuses;
  protected readonly kind = incidentKind;
  protected readonly statusLabel = incidentStatus;
  protected readonly label = animalLabel;
  protected readonly today = today();
  protected readonly page = signal<Page<Incident>>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly filterKind = signal('');
  protected readonly animalFilter = signal('');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly animals = signal<AnimalOption[]>([]);
  protected readonly animalSearch = signal('');
  protected readonly animalLoading = signal(false);
  protected readonly cases = signal<IncidentCase[]>([]);
  protected readonly caseSearch = signal('');
  protected readonly caseLoading = signal(false);
  protected readonly optionsError = signal('');
  protected readonly detail = signal<IncidentDetail | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly followOpen = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    date: [this.today, Validators.required],
    kind: ['accident', Validators.required],
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    location: ['', Validators.maxLength(190)],
    initial_actions: ['', Validators.maxLength(5000)],
    health_case_id: [''],
  });
  protected readonly followForm = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    status: ['in_progress', Validators.required],
    notes: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    health_case_id: [''],
  });
  private destroyed = false;
  private listRequest = 0;
  private animalRequest = 0;
  private caseRequest = 0;
  private detailRequest = 0;
  ngOnInit() {
    this.animalFilter.set(this.route.snapshot.queryParamMap.get('animal_id') || '');
    if (this.canRead()) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.animalRequest++;
    this.caseRequest++;
    this.detailRequest++;
  }
  async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page<Incident>>(`${this.api}/health/incidents`, {
            params: {
              q: this.search(),
              offset,
              limit: 25,
              ...(this.status() ? { status: this.status() } : {}),
              ...(this.filterKind() ? { kind: this.filterKind() } : {}),
              ...(this.animalFilter() ? { animal_id: this.animalFilter() } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.listRequest && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.listRequest && !this.destroyed) {
        this.page.set({ items: [], total: 0, offset: 0, limit: 25 });
        this.error.set(apiError(e, 'No se pudieron cargar los incidentes.'));
      }
    } finally {
      if (n === this.listRequest && !this.destroyed) this.loading.set(false);
    }
  }
  async start() {
    if (!this.canWrite()) return;
    this.form.reset({
      animal_id: '',
      date: today(),
      kind: 'accident',
      description: '',
      location: '',
      initial_actions: '',
      health_case_id: '',
    });
    this.formError.set('');
    this.optionsError.set('');
    this.animalSearch.set('');
    this.caseSearch.set('');
    this.animals.set([]);
    this.cases.set([]);
    this.formOpen.set(true);
    await this.findAnimals();
  }
  dismiss() {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.animalRequest++;
    this.caseRequest++;
  }
  async findAnimals() {
    const n = ++this.animalRequest;
    this.animalLoading.set(true);
    this.optionsError.set('');
    try {
      const p = await this.repo.options(this.animalSearch());
      if (n === this.animalRequest && !this.destroyed) {
        const selected = this.animals().find((a) => a.id === this.form.controls.animal_id.value);
        this.animals.set(selected && !p.some((a) => a.id === selected.id) ? [selected, ...p] : p);
      }
    } catch (e) {
      if (n === this.animalRequest && !this.destroyed)
        this.optionsError.set(apiError(e, 'No se pudieron consultar los animales.'));
    } finally {
      if (n === this.animalRequest && !this.destroyed) this.animalLoading.set(false);
    }
  }
  animalChanged() {
    this.form.controls.health_case_id.setValue('');
    this.caseSearch.set('');
    this.cases.set([]);
    void this.findCases();
  }
  async findCases() {
    const animal = this.formOpen()
        ? this.form.controls.animal_id.value
        : this.detail()?.incident.animal.id,
      n = ++this.caseRequest;
    this.optionsError.set('');
    if (!animal) {
      this.caseLoading.set(false);
      return;
    }
    this.caseLoading.set(true);
    try {
      const p = await firstValueFrom(
        this.http
          .get<IncidentCase[]>(`${this.api}/health/incidents/case-options`, {
            params: { animal_id: animal, q: this.caseSearch(), limit: 50 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.caseRequest && !this.destroyed) {
        const id = this.formOpen()
            ? this.form.controls.health_case_id.value
            : this.followForm.controls.health_case_id.value,
          selected = this.cases().find((c) => c.id === id);
        this.cases.set(selected && !p.some((c) => c.id === id) ? [selected, ...p] : p);
      }
    } catch (e) {
      if (n === this.caseRequest && !this.destroyed)
        this.optionsError.set(apiError(e, 'No se pudieron consultar los casos.'));
    } finally {
      if (n === this.caseRequest && !this.destroyed) this.caseLoading.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy()) return;
    this.formError.set('');
    const v = this.form.getRawValue();
    if (this.form.invalid || v.date > today()) {
      this.formError.set('Completa animal, tipo, descripción y una fecha que no sea futura.');
      return;
    }
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.http
          .post<Incident>(`${this.api}/health/incidents`, {
            ...v,
            description: v.description.trim(),
            location: v.location.trim() || null,
            initial_actions: v.initial_actions.trim() || null,
            health_case_id: v.health_case_id || null,
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.formOpen.set(false);
        this.success.set('Incidente registrado. Puedes añadir notas desde Ver incidente.');
        await this.load();
        await this.view(r.id);
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo registrar el incidente.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  async view(id: string, offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.detailRequest;
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detailError.set('');
    if (offset === 0) {
      this.detail.set(null);
      this.followOpen.set(false);
      this.caseRequest++;
    }
    try {
      const d = await firstValueFrom(
        this.http
          .get<IncidentDetail>(`${this.api}/health/incidents/${id}`, {
            params: { offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.detailRequest && !this.destroyed) this.detail.set(d);
    } catch (e) {
      if (n === this.detailRequest && !this.destroyed)
        this.detailError.set(apiError(e, 'No se pudo consultar el incidente.'));
    } finally {
      if (n === this.detailRequest && !this.destroyed) this.detailLoading.set(false);
    }
  }
  closeDetail() {
    if (this.busy()) return;
    this.detailOpen.set(false);
    this.detail.set(null);
    this.detailRequest++;
    this.caseRequest++;
  }
  async startFollowup() {
    if (!this.canWrite()) return;
    this.followForm.reset({
      date: today(),
      status: this.detail()?.incident.status === 'closed' ? 'open' : 'in_progress',
      notes: '',
      health_case_id: '',
    });
    this.formError.set('');
    this.optionsError.set('');
    this.cases.set([]);
    this.caseSearch.set('');
    this.followOpen.set(true);
    await this.findCases();
  }
  async saveFollowup() {
    this.followForm.markAllAsTouched();
    const d = this.detail();
    if (!d || !this.canWrite() || this.busy()) return;
    const v = this.followForm.getRawValue();
    this.formError.set('');
    if (
      this.followForm.invalid ||
      v.date > today() ||
      v.date < (d.last_followup_date || d.incident.date)
    ) {
      this.formError.set('Escribe una nota y una fecha entre el último registro y hoy.');
      return;
    }
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(
        this.http
          .post<IncidentDetail>(`${this.api}/health/incidents/${d.incident.id}/followups`, {
            ...v,
            notes: v.notes.trim(),
            health_case_id: v.health_case_id || null,
            expected_version: d.incident.version,
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.detail.set(updated);
        this.followOpen.set(false);
        this.success.set('Seguimiento registrado. Se conservan las notas anteriores.');
        await this.load(this.page().offset);
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo registrar el seguimiento.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
