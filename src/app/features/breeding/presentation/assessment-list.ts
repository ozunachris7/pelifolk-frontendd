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
  Assessment,
  AssessmentPage,
  AssessmentRubric,
  BirthOption,
  BirthPage,
  assessmentKind,
  physicalAnimalLabel,
} from '../domain/assessment';
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-assessment-list',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, LucideAngularModule, Modal],
  templateUrl: './assessment-list.html',
})
export class AssessmentList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly canRead = computed(
    () => !!this.session.user()?.permissions.includes('breeding:read'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && !!this.session.user()?.permissions.includes('breeding:write'),
  );
  protected readonly plus = Plus;
  protected readonly eye = Eye;
  protected readonly kindLabel = assessmentKind;
  protected readonly label = physicalAnimalLabel;
  protected readonly today = today();
  protected readonly search = signal('');
  protected readonly filterKind = signal('');
  protected readonly animalFilter = signal('');
  protected readonly page = signal<AssessmentPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly formError = signal('');
  protected readonly rubric = signal<AssessmentRubric | null>(null);
  protected readonly rubricLoading = signal(false);
  protected readonly births = signal<BirthPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly birthSearch = signal('');
  protected readonly birthLoading = signal(false);
  protected readonly optionsError = signal('');
  protected readonly selectedBirth = signal<BirthOption | null>(null);
  protected readonly detail = signal<Assessment | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    birth_event_id: ['', Validators.required],
    kind: ['maternal', Validators.required],
    offspring_id: [''],
    date: [this.today, Validators.required],
    evaluated_by: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(190)]],
    findings: this.fb.nonNullable.group({
      acceptance: ['', Validators.maxLength(2000)],
      nursing: ['', Validators.maxLength(2000)],
      care: ['', Validators.maxLength(2000)],
      body_features: ['', Validators.maxLength(2000)],
      movement: ['', Validators.maxLength(2000)],
      development: ['', Validators.maxLength(2000)],
    }),
    notes: ['', Validators.maxLength(5000)],
  });
  private destroyed = false;
  private listRequest = 0;
  private birthRequest = 0;
  private rubricRequest = 0;
  ngOnInit() {
    this.animalFilter.set(this.route.snapshot.queryParamMap.get('animal_id') || '');
    if (this.canRead()) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.birthRequest++;
    this.rubricRequest++;
  }
  count(r: Assessment) {
    return r.findings.filter((f) => !!f.observation).length;
  }
  birthInPage(b: BirthOption) {
    return this.births().items.some((r) => r.id === b.id);
  }
  birthChanged() {
    const id = this.form.controls.birth_event_id.value;
    this.selectedBirth.set(
      this.births().items.find((b) => b.id === id) ||
        (this.selectedBirth()?.id === id ? this.selectedBirth() : null),
    );
    this.form.controls.offspring_id.setValue('');
  }
  kindChanged() {
    this.form.controls.offspring_id.setValue('');
    this.form.controls.findings.reset();
    void this.loadRubric();
  }
  async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<AssessmentPage>(`${this.api}/breeding/assessments`, {
            params: {
              q: this.search(),
              offset,
              limit: 25,
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
        this.error.set(apiError(e, 'No se pudieron consultar las evaluaciones.'));
      }
    } finally {
      if (n === this.listRequest && !this.destroyed) this.loading.set(false);
    }
  }
  async start() {
    if (!this.canWrite()) return;
    const u = this.session.user();
    const name = u
      ? [u.name, u.middle_name, u.paternal_lastname, u.maternal_lastname].filter(Boolean).join(' ')
      : '';
    this.form.reset({
      birth_event_id: '',
      kind: 'maternal',
      offspring_id: '',
      date: today(),
      evaluated_by: name,
      findings: {
        acceptance: '',
        nursing: '',
        care: '',
        body_features: '',
        movement: '',
        development: '',
      },
      notes: '',
    });
    this.formError.set('');
    this.optionsError.set('');
    this.rubric.set(null);
    this.births.set({ items: [], total: 0, offset: 0, limit: 25 });
    this.selectedBirth.set(null);
    this.birthSearch.set('');
    this.formOpen.set(true);
    await Promise.all([this.loadRubric(), this.findBirths()]);
  }
  dismiss() {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.birthRequest++;
    this.rubricRequest++;
  }
  async loadRubric() {
    const n = ++this.rubricRequest;
    this.rubricLoading.set(true);
    this.formError.set('');
    this.rubric.set(null);
    try {
      const r = await firstValueFrom(
        this.http
          .get<AssessmentRubric>(`${this.api}/breeding/assessments/criteria`, {
            params: { kind: this.form.controls.kind.value },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.rubricRequest && !this.destroyed) this.rubric.set(r);
    } catch (e) {
      if (n === this.rubricRequest && !this.destroyed)
        this.formError.set(apiError(e, 'No se pudieron cargar los criterios.'));
    } finally {
      if (n === this.rubricRequest && !this.destroyed) this.rubricLoading.set(false);
    }
  }
  async findBirths(offset = 0) {
    const n = ++this.birthRequest;
    this.birthLoading.set(true);
    this.optionsError.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<BirthPage>(`${this.api}/breeding/assessments/birth-options`, {
            params: { q: this.birthSearch(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.birthRequest && !this.destroyed) this.births.set(p);
    } catch (e) {
      if (n === this.birthRequest && !this.destroyed)
        this.optionsError.set(apiError(e, 'No se pudieron consultar los partos.'));
    } finally {
      if (n === this.birthRequest && !this.destroyed) this.birthLoading.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy()) return;
    this.formError.set('');
    const v = this.form.getRawValue(),
      rubric = this.rubric(),
      birth = this.selectedBirth(),
      values = v.findings as Record<string, string>;
    const findings = Object.fromEntries(
      (rubric?.criteria || []).map((c) => [c.code, values[c.code]?.trim() || null]),
    );
    if (
      !rubric ||
      !birth ||
      this.form.invalid ||
      v.date > today() ||
      v.date < birth.date ||
      !Object.values(findings).some(Boolean) ||
      (v.kind === 'offspring' && !v.offspring_id)
    ) {
      this.formError.set(
        'Selecciona el parto, el animal a evaluar, una fecha desde el parto y el evaluador. Describe al menos un apartado.',
      );
      return;
    }
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.http
          .post<Assessment>(`${this.api}/breeding/assessments`, {
            birth_event_id: v.birth_event_id,
            kind: v.kind,
            offspring_id: v.kind === 'offspring' ? v.offspring_id : null,
            date: v.date,
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
