import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus, Eye } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import {
  PhysicalAnimal,
  PhysicalEvaluation,
  PhysicalPage,
  PhysicalRubric,
  physicalAnimalLabel,
} from '../domain/physical';
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-physical-list',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, LucideAngularModule, Modal],
  templateUrl: './physical-list.html',
})
export class PhysicalList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly canRead = computed(
    () => !!this.session.user()?.permissions.includes('animals:read'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && !!this.session.user()?.permissions.includes('animals:write'),
  );
  protected readonly plus = Plus;
  protected readonly eye = Eye;
  protected readonly label = physicalAnimalLabel;
  protected readonly today = today();
  protected readonly search = signal('');
  protected readonly animalFilter = signal('');
  protected readonly page = signal<PhysicalPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly formError = signal('');
  protected readonly rubric = signal<PhysicalRubric | null>(null);
  protected readonly rubricLoading = signal(false);
  protected readonly animals = signal<PhysicalAnimal[]>([]);
  protected readonly animalSearch = signal('');
  protected readonly animalLoading = signal(false);
  protected readonly optionsError = signal('');
  protected readonly detail = signal<PhysicalEvaluation | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    date: [this.today, Validators.required],
    evaluated_by: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(190)]],
    findings: this.fb.nonNullable.group({
      body_structure: ['', Validators.maxLength(2000)],
      limbs_hooves: ['', Validators.maxLength(2000)],
      movement: ['', Validators.maxLength(2000)],
      coat_features: ['', Validators.maxLength(2000)],
    }),
    notes: ['', Validators.maxLength(5000)],
  });
  private destroyed = false;
  private listRequest = 0;
  private animalRequest = 0;
  private rubricRequest = 0;
  ngOnInit() {
    this.animalFilter.set(this.route.snapshot.queryParamMap.get('animal_id') || '');
    if (this.canRead()) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.animalRequest++;
    this.rubricRequest++;
  }
  count(r: PhysicalEvaluation) {
    return r.findings.filter((f) => !!f.observation).length;
  }
  async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<PhysicalPage>(`${this.api}/physical-evaluations`, {
            params: {
              q: this.search(),
              offset,
              limit: 25,
              ...(this.animalFilter() ? { animal_id: this.animalFilter() } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.listRequest && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.listRequest && !this.destroyed) {
        this.page.set({ items: [], total: 0, offset: 0, limit: 25 });
        this.error.set(apiError(e, 'No se pudieron consultar las evaluaciones.'));
      }
    } finally {
      if (n === this.listRequest && !this.destroyed) this.loading.set(false);
    }
  }
  async start() {
    if (!this.canWrite()) return;
    const user = this.session.user();
    const name = user
      ? [user.name, user.middle_name, user.paternal_lastname, user.maternal_lastname]
          .filter(Boolean)
          .join(' ')
      : '';
    this.form.reset({
      animal_id: '',
      date: today(),
      evaluated_by: name,
      findings: { body_structure: '', limbs_hooves: '', movement: '', coat_features: '' },
      notes: '',
    });
    this.formError.set('');
    this.optionsError.set('');
    this.rubric.set(null);
    this.animals.set([]);
    this.animalSearch.set('');
    this.formOpen.set(true);
    await Promise.all([this.loadRubric(), this.findAnimals()]);
  }
  dismiss() {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.animalRequest++;
    this.rubricRequest++;
  }
  async loadRubric() {
    const n = ++this.rubricRequest;
    this.rubricLoading.set(true);
    this.formError.set('');
    try {
      const r = await firstValueFrom(
        this.http
          .get<PhysicalRubric>(`${this.api}/physical-evaluations/criteria`)
          .pipe(timeout(15000)),
      );
      if (n === this.rubricRequest && !this.destroyed) this.rubric.set(r);
    } catch (e) {
      if (n === this.rubricRequest && !this.destroyed)
        this.formError.set(
          apiError(e, 'No se pudieron cargar los criterios. Pulsa Reintentar criterios.'),
        );
    } finally {
      if (n === this.rubricRequest && !this.destroyed) this.rubricLoading.set(false);
    }
  }
  async findAnimals() {
    const n = ++this.animalRequest;
    this.animalLoading.set(true);
    this.optionsError.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<PhysicalAnimal[]>(`${this.api}/physical-evaluations/animal-options`, {
            params: { q: this.animalSearch(), limit: 50 },
          })
          .pipe(timeout(15000)),
      );
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
  async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy()) return;
    this.formError.set('');
    const v = this.form.getRawValue(),
      rubric = this.rubric(),
      findings = Object.fromEntries(
        Object.entries(v.findings).map(([key, value]) => [key, value.trim() || null]),
      );
    if (
      !rubric ||
      this.form.invalid ||
      v.date > today() ||
      !Object.values(findings).some(Boolean)
    ) {
      this.formError.set(
        'Selecciona un animal, fecha y evaluador, y describe al menos un apartado. Los demás pueden quedar sin evaluar.',
      );
      return;
    }
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.http
          .post<PhysicalEvaluation>(`${this.api}/physical-evaluations`, {
            ...v,
            evaluated_by: v.evaluated_by.trim(),
            findings,
            notes: v.notes.trim() || null,
            rubric_version: rubric.version,
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.formOpen.set(false);
        this.success.set('Evaluación registrada. Las anteriores permanecen en el historial.');
        this.detail.set(r);
        await this.load();
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar la evaluación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
