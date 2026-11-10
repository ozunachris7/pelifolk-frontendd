import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus, Eye, Check } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { HealthNav } from './health-nav';
import { HealthRepository } from '../infrastructure/health-repository';
import { AnimalOption, Product, Page, animalLabel } from '../domain/health';
import { Reaction, ReactionDose, ReactionPage, reactionKind } from '../domain/reaction';
import { withdrawalApplicationLabel } from '../domain/withdrawal';
export function localReactionDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-reaction-list',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule, HealthNav, Modal],
  providers: [HealthRepository],
  templateUrl: './reaction-list.html',
})
export class ReactionList implements OnInit, OnDestroy {
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
    () => this.canRead() && !!this.session.user()?.permissions.includes('health:reactions:write'),
  );
  protected readonly plus = Plus;
  protected readonly eye = Eye;
  protected readonly check = Check;
  protected readonly label = animalLabel;
  protected readonly kind = reactionKind;
  protected readonly applied = withdrawalApplicationLabel;
  protected readonly page = signal<ReactionPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly animalFilter = signal('');
  protected readonly formOpen = signal(false);
  protected readonly detail = signal<Reaction | null>(null);
  protected readonly closing = signal(false);
  protected readonly formError = signal('');
  protected readonly animals = signal<AnimalOption[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly doses = signal<Page<ReactionDose>>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly animalSearch = signal('');
  protected readonly productSearch = signal('');
  protected readonly optionError = signal('');
  protected readonly animalLoading = signal(false);
  protected readonly productLoading = signal(false);
  protected readonly doseLoading = signal(false);
  protected readonly today = localReactionDay();
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    date: [this.today, Validators.required],
    kind: ['adverse_reaction', Validators.required],
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    suspected_agent: ['', Validators.maxLength(190)],
    product_id: [''],
    dose_id: [''],
  });
  protected readonly closureForm = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    notes: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
  });
  private destroyed = false;
  private listRequest = 0;
  private animalRequest = 0;
  private productRequest = 0;
  private doseRequest = 0;
  ngOnInit() {
    this.animalFilter.set(this.route.snapshot.queryParamMap.get('animal_id') || '');
    if (this.canRead()) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.animalRequest++;
    this.productRequest++;
    this.doseRequest++;
  }
  async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<ReactionPage>(`${this.api}/health/reactions`, {
            params: {
              q: this.search(),
              offset,
              limit: 25,
              ...(this.status() ? { status: this.status() } : {}),
              ...(this.animalFilter() ? { animal_id: this.animalFilter() } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.listRequest && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.listRequest && !this.destroyed) {
        this.page.set({ items: [], total: 0, offset: 0, limit: 25 });
        this.error.set(apiError(e, 'No se pudieron cargar los reportes.'));
      }
    } finally {
      if (n === this.listRequest && !this.destroyed) this.loading.set(false);
    }
  }
  async start() {
    if (!this.canWrite()) return;
    this.form.reset({
      animal_id: '',
      date: localReactionDay(),
      kind: 'adverse_reaction',
      description: '',
      suspected_agent: '',
      product_id: '',
      dose_id: '',
    });
    this.formError.set('');
    this.optionError.set('');
    this.animalSearch.set('');
    this.productSearch.set('');
    this.animals.set([]);
    this.products.set([]);
    this.doses.set({ items: [], total: 0, offset: 0, limit: 25 });
    this.formOpen.set(true);
    await Promise.all([this.findAnimals(), this.findProducts()]);
  }
  dismiss() {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.animalRequest++;
    this.productRequest++;
    this.doseRequest++;
  }
  async findAnimals() {
    const n = ++this.animalRequest;
    this.animalLoading.set(true);
    this.optionError.set('');
    try {
      const p = await this.repo.options(this.animalSearch());
      if (n === this.animalRequest && !this.destroyed) {
        const selected = this.animals().find((a) => a.id === this.form.controls.animal_id.value);
        this.animals.set(selected && !p.some((a) => a.id === selected.id) ? [selected, ...p] : p);
      }
    } catch (e) {
      if (n === this.animalRequest && !this.destroyed)
        this.optionError.set(apiError(e, 'No se pudieron consultar los animales.'));
    } finally {
      if (n === this.animalRequest && !this.destroyed) this.animalLoading.set(false);
    }
  }
  async findProducts() {
    const n = ++this.productRequest;
    this.productLoading.set(true);
    this.optionError.set('');
    try {
      const p = await this.repo.products(this.productSearch(), null, 0, 50);
      if (n === this.productRequest && !this.destroyed) {
        const selected = this.products().find((a) => a.id === this.form.controls.product_id.value);
        this.products.set(
          selected && !p.items.some((a) => a.id === selected.id) ? [selected, ...p.items] : p.items,
        );
      }
    } catch (e) {
      if (n === this.productRequest && !this.destroyed)
        this.optionError.set(apiError(e, 'No se pudieron consultar los productos.'));
    } finally {
      if (n === this.productRequest && !this.destroyed) this.productLoading.set(false);
    }
  }
  sourceChanged() {
    this.form.controls.dose_id.setValue('');
    this.doses.set({ items: [], total: 0, offset: 0, limit: 25 });
    void this.loadDoses();
  }
  async loadDoses(offset = 0) {
    const animal = this.form.controls.animal_id.value,
      n = ++this.doseRequest;
    this.optionError.set('');
    if (!animal) {
      this.doseLoading.set(false);
      return;
    }
    this.doseLoading.set(true);
    try {
      const product = this.form.controls.product_id.value;
      const p = await firstValueFrom(
        this.http
          .get<Page<ReactionDose>>(`${this.api}/health/reactions/dose-options`, {
            params: {
              animal_id: animal,
              offset,
              limit: 25,
              ...(product ? { product_id: product } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.doseRequest && !this.destroyed) this.doses.set(p);
    } catch (e) {
      if (n === this.doseRequest && !this.destroyed)
        this.optionError.set(apiError(e, 'No se pudieron cargar las dosis.'));
    } finally {
      if (n === this.doseRequest && !this.destroyed) this.doseLoading.set(false);
    }
  }
  dosePage(offset: number) {
    this.form.controls.dose_id.setValue('');
    void this.loadDoses(offset);
  }
  async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy()) return;
    this.formError.set('');
    const v = this.form.getRawValue(),
      d = this.doses().items.find((r) => r.id === v.dose_id);
    if (
      this.form.invalid ||
      v.date > localReactionDay() ||
      (d && v.date < d.applied_at.slice(0, 10))
    ) {
      this.formError.set(
        'Completa el animal, fecha, tipo y descripción. La reacción no puede ser futura ni anterior a la dosis vinculada.',
      );
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http
          .post<Reaction>(`${this.api}/health/reactions`, {
            ...v,
            description: v.description.trim(),
            suspected_agent: v.suspected_agent.trim() || null,
            product_id: v.product_id || null,
            dose_id: v.dose_id || null,
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.formOpen.set(false);
        this.success.set(
          'Reporte registrado. El antecedente ya es visible en la ficha y en los casos del animal.',
        );
        await this.load();
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo registrar el reporte.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  view(r: Reaction) {
    this.detail.set(r);
    this.closing.set(false);
    this.formError.set('');
    this.closureForm.reset({ date: localReactionDay(), notes: '' });
  }
  async closeFollowup() {
    const r = this.detail();
    this.closureForm.markAllAsTouched();
    if (!r || !this.canWrite() || this.busy()) return;
    const v = this.closureForm.getRawValue();
    if (this.closureForm.invalid || v.date < r.date || v.date > localReactionDay()) {
      this.formError.set('Escribe el motivo y una fecha entre el reporte y hoy.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const updated = await firstValueFrom(
        this.http
          .post<Reaction>(`${this.api}/health/reactions/${r.id}/closure`, {
            ...v,
            notes: v.notes.trim(),
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.detail.set(updated);
        this.closing.set(false);
        this.success.set('Seguimiento cerrado. El antecedente permanece en el historial.');
        await this.load(this.page().offset);
      }
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo cerrar el seguimiento.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
