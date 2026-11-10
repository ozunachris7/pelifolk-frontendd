import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus, History, Eye } from 'lucide-angular';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { apiError } from '../../core/http/api-error';
import { Modal } from '../../shared/ui/modal/modal';
import { hasPermission } from '../users/domain/access';
import { ManagementNav } from '../weights/presentation/management-nav';
import { AnimalOption, WeightHistory, animalLabel } from '../weights/domain/weights';
interface Option extends AnimalOption {
  birth_date: string | null;
  mother: AnimalOption | null;
}
interface Weaning {
  id: string;
  animal: AnimalOption;
  mother: AnimalOption | null;
  date: string;
  weight_kg: string;
  age_days: number | null;
  birth_date_snapshot: string | null;
  notes: string | null;
  recorded_by: string;
}
interface Page {
  items: Weaning[];
  total: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-weaning-list',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, LucideAngularModule, ManagementNav, Modal],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="mb-2 text-xs text-stone-500">Mi rancho / Manejo</p>
        <h1 class="text-2xl font-semibold">Destetes</h1>
        <p class="mt-2 text-sm text-stone-500">
          Fecha, peso y seguimiento del destete de cada animal.
        </p>
      </div>
      @if (canWrite()) {
        <button
          type="button"
          data-testid="new-weaning"
          (click)="start()"
          class="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950"
        >
          <lucide-icon [img]="plus" [size]="16" aria-hidden="true" />Registrar destete
        </button>
      }
    </header>
    <app-management-nav />
    @if (!canRead()) {
      <p>No tienes permiso para consultar manejo.</p>
    } @else {
      @if (success()) {
        <p role="status" class="mb-4 text-sm text-green-800 dark:text-green-200">{{ success() }}</p>
      }
      <form [formGroup]="search" (ngSubmit)="load()" class="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Buscar animal"
          formControlName="q"
          maxlength="100"
          placeholder="Nombre o SINIIGA"
          class="min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        /><button type="submit" class="rounded-lg bg-green-900 px-4 py-2 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-950">
          Buscar
        </button>
      </form>
      @if (error()) {
        <p role="alert" class="mb-4 text-sm text-red-600">{{ error() }}</p>
      }
      @if (loading()) {
        <p>Cargando destetes…</p>
      } @else {
        <div
          class="min-w-0 overflow-x-auto rounded-lg border border-stone-200 dark:border-white/10"
        >
          <table class="w-full text-left text-sm">
            <thead class="bg-stone-50 text-xs text-stone-500 dark:bg-[#1c1b19]">
              <tr>
                <th class="p-4">Animal</th>
                <th class="p-4">Madre al registrar</th>
                <th class="p-4">Destete</th>
                <th class="p-4">Peso</th>
                <th class="p-4">Edad</th>
                <th class="p-4">Historial</th>
              </tr>
            </thead>
            <tbody>
              @for (w of page().items; track w.id) {
                <tr data-weaning-row class="border-t border-stone-200 dark:border-white/10">
                  <td class="p-4 font-medium">{{ label(w.animal) }}</td>
                  <td class="p-4">{{ w.mother ? label(w.mother) : 'Sin madre registrada' }}</td>
                  <td class="whitespace-nowrap p-4">{{ w.date | date: 'dd/MM/yyyy' : 'UTC' }}</td>
                  <td class="whitespace-nowrap p-4">{{ w.weight_kg | number: '1.2-2' }} kg</td>
                  <td class="whitespace-nowrap p-4">
                    {{ w.age_days === null ? 'Desconocida' : w.age_days + ' días' }}
                  </td>
                  <td class="p-4">
                    <div class="flex gap-3">
                      <button
                        type="button"
                        (click)="detail.set(w)"
                        class="inline-flex items-center gap-1 text-xs underline underline-offset-4"
                      >
                        <lucide-icon [img]="eye" [size]="15" aria-hidden="true" />Ver</button
                      ><button
                        type="button"
                        (click)="showWeights(w.animal)"
                        class="inline-flex items-center gap-1 text-xs underline underline-offset-4"
                      >
                        <lucide-icon [img]="historyIcon" [size]="15" aria-hidden="true" />Pesajes
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-8 text-center text-stone-500">
                    No hay destetes registrados con esta búsqueda.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>{{ page().total }} registros</p>
          <div class="flex gap-4">
            <button
              type="button"
              [disabled]="page().offset === 0"
              (click)="load(page().offset - 25)"
              class="disabled:opacity-40"
            >
              Anterior</button
            ><button
              type="button"
              [disabled]="page().offset + 25 >= page().total"
              (click)="load(page().offset + 25)"
              class="disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      }
    }
    @if (formOpen() && !weightsOpen()) {
      <app-modal title="Registrar destete" [busy]="busy()" (dismiss)="closeForm()"
        ><form [formGroup]="form" (ngSubmit)="save()">
          <fieldset [disabled]="busy()" class="min-w-0 space-y-5">
            <div class="flex flex-wrap gap-2">
              <input
                aria-label="Buscar animal para destete"
                [formControl]="optionSearch"
                maxlength="100"
                placeholder="Nombre o SINIIGA"
                class="min-w-0 flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              /><button
                type="button"
                (click)="loadOptions()"
                [disabled]="optionLoading()"
                class="rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
              >
                Buscar animal
              </button>
            </div>
            <div>
              <label for="weaning-animal" class="mb-2 block text-xs">Animal a destetar *</label
              ><select
                id="weaning-animal"
                formControlName="animal_id"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
              >
                <option value="">Selecciona un animal</option>
                @for (a of options(); track a.id) {
                  <option [value]="a.id">{{ label(a) }}</option>
                }
              </select>
              <p class="mt-2 text-xs text-stone-500">
                Animales activos que aún no tienen destete registrado.
              </p>
            </div>
            @if (optionLoading()) {
              <p>Cargando animales…</p>
            }
            @if (selected(); as a) {
              <div class="border-l-2 border-stone-300 pl-3 text-xs text-stone-500">
                <p>Madre: {{ a.mother ? label(a.mother) : 'Sin registrar' }}</p>
                <p class="mt-1">
                  Nacimiento:
                  {{
                    a.birth_date
                      ? (a.birth_date | date: 'dd/MM/yyyy' : 'UTC')
                      : 'Desconocido; no se calculará edad'
                  }}
                </p>
                <button
                  type="button"
                  (click)="showWeights(a)"
                  class="mt-2 underline underline-offset-4"
                >
                  Consultar pesajes
                </button>
              </div>
            }
            <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="min-w-0">
                <label for="weaning-date" class="mb-2 block text-xs">Fecha de destete *</label
                ><input
                  id="weaning-date"
                  type="date"
                  formControlName="date"
                  [max]="today"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                />
              </div>
              <div class="min-w-0">
                <label for="weaning-weight" class="mb-2 block text-xs">Peso al destete (kg) *</label
                ><input
                  id="weaning-weight"
                  type="number"
                  formControlName="weight_kg"
                  min="0.01"
                  max="99999.99"
                  step="0.01"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                />
              </div>
            </div>
            <div>
              <label for="weaning-notes" class="mb-2 block text-xs">Observaciones</label
              ><textarea
                id="weaning-notes"
                formControlName="notes"
                maxlength="2000"
                rows="3"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              ></textarea>
            </div>
            <p class="text-xs text-stone-500">
              El peso se guarda en el historial de pesajes. Si ya existe uno ese día, introduce el
              mismo valor para reutilizarlo. Se conserva un registro de destete por animal.
            </p>
            @if (formError()) {
              <p role="alert" class="text-sm text-red-600">{{ formError() }}</p>
            }
            <div class="flex justify-end gap-3">
              <button type="button" (click)="closeForm()" class="px-3 py-3 text-xs">Cancelar</button
              ><button
                type="submit"
                [disabled]="!optionReady()"
                class="rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950 disabled:opacity-50"
              >
                {{ busy() ? 'Guardando…' : 'Guardar destete' }}
              </button>
            </div>
          </fieldset>
        </form></app-modal
      >
    }
    @if (detail(); as w) {
      <app-modal title="Registro de destete" (dismiss)="detail.set(null)"
        ><h2 class="text-lg font-medium">{{ label(w.animal) }}</h2>
        <dl class="mt-5 grid min-w-0 grid-cols-1 gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs text-stone-500">Madre al registrar</dt>
            <dd class="mt-1">{{ w.mother ? label(w.mother) : 'Sin registrar' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-stone-500">Fecha</dt>
            <dd class="mt-1">{{ w.date | date: 'dd/MM/yyyy' : 'UTC' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-stone-500">Peso al destete</dt>
            <dd class="mt-1">{{ w.weight_kg | number: '1.2-2' }} kg</dd>
          </div>
          <div>
            <dt class="text-xs text-stone-500">Edad según nacimiento registrado entonces</dt>
            <dd class="mt-1">{{ w.age_days === null ? 'Desconocida' : w.age_days + ' días' }}</dd>
          </div>
        </dl>
        @if (w.notes) {
          <p class="mt-5 whitespace-pre-wrap break-words text-sm">{{ w.notes }}</p>
        }
        <p class="mt-5 text-xs text-stone-500">Registró: {{ w.recorded_by }}</p></app-modal
      >
    }
    @if (weightsOpen()) {
      <app-modal title="Historial de pesajes" (dismiss)="closeWeights()">
        @if (weightsLoading()) {
          <p>Cargando pesajes…</p>
        }
        @if (weightsError()) {
          <p role="alert" class="text-sm text-red-600">{{ weightsError() }}</p>
        }
        @if (weights(); as h) {
          <h2 class="mb-5 text-lg font-medium">{{ label(h.animal) }}</h2>
          <ol class="space-y-4 border-l border-stone-200 pl-4 dark:border-white/10">
            @for (w of h.items; track w.id) {
              <li>
                <p class="text-sm">
                  {{ w.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ w.weight_kg | number: '1.2-2' }} kg
                  @if (w.is_weaning) {
                    · Destete
                  }
                </p>
                <p class="mt-1 text-xs text-stone-500">{{ w.recorded_by }}</p>
              </li>
            } @empty {
              <li class="text-sm text-stone-500">Sin pesajes registrados.</li>
            }
          </ol>
        }
        <button
          type="button"
          (click)="closeWeights()"
          class="mt-6 rounded-lg border border-stone-200 px-4 py-3 text-xs dark:border-white/15"
        >
          {{ formOpen() ? 'Volver al registro' : 'Cerrar' }}
        </button></app-modal
      >
    }
  `,
})
export class WeaningList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(Session);
  private destroyed = false;
  private listRequest = 0;
  private optionRequest = 0;
  private weightRequest = 0;
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'weights:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'weights:write'),
  );
  protected readonly plus = Plus;
  protected readonly eye = Eye;
  protected readonly historyIcon = History;
  protected readonly label = animalLabel;
  protected readonly page = signal<Page>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly formError = signal('');
  protected readonly options = signal<Option[]>([]);
  protected readonly optionLoading = signal(false);
  protected readonly optionReady = signal(false);
  protected readonly optionSearch = this.fb.nonNullable.control('');
  protected readonly detail = signal<Weaning | null>(null);
  protected readonly search = this.fb.nonNullable.group({ q: ['', Validators.maxLength(100)] });
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    date: [this.today, Validators.required],
    weight_kg: [
      0,
      [
        Validators.required,
        Validators.min(0.01),
        Validators.max(99999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
    notes: ['', Validators.maxLength(2000)],
  });
  protected readonly selected = computed(() =>
    this.options().find((a) => a.id === this.selectedId()),
  );
  private readonly selectedId = signal('');
  private readonly animalSubscription = this.form.controls.animal_id.valueChanges.subscribe((id) =>
    this.selectedId.set(id),
  );
  protected readonly weightsOpen = signal(false);
  protected readonly weights = signal<WeightHistory | null>(null);
  protected readonly weightsLoading = signal(false);
  protected readonly weightsError = signal('');
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.optionRequest++;
    this.weightRequest++;
    this.animalSubscription.unsubscribe();
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed || this.search.invalid) return;
    const request = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const value = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/weanings`, {
            params: { q: this.search.getRawValue().q.trim(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (request === this.listRequest) this.page.set(value);
    } catch (e) {
      if (request === this.listRequest)
        this.error.set(apiError(e, 'No se pudieron cargar los destetes.'));
    } finally {
      if (request === this.listRequest) this.loading.set(false);
    }
  }
  protected start() {
    if (!this.canWrite() || this.busy()) return;
    this.form.reset({ animal_id: '', date: this.today, weight_kg: 0, notes: '' });
    this.optionSearch.reset();
    this.options.set([]);
    this.optionReady.set(false);
    this.formError.set('');
    this.formOpen.set(true);
    void this.loadOptions();
  }
  protected closeForm() {
    if (this.busy()) return;
    this.optionRequest++;
    this.formOpen.set(false);
  }
  protected async loadOptions() {
    if (!this.formOpen() || this.destroyed) return;
    const request = ++this.optionRequest;
    this.optionLoading.set(true);
    this.formError.set('');
    try {
      const options = await firstValueFrom(
        this.http
          .get<Option[]>(`${this.api}/weanings/animal-options`, {
            params: { q: this.optionSearch.value.trim(), limit: 100 },
          })
          .pipe(timeout(15000)),
      );
      if (request === this.optionRequest) {
        const selected = this.selected();
        this.options.set(
          selected && !options.some((a) => a.id === selected.id) ? [selected, ...options] : options,
        );
        this.optionReady.set(true);
      }
    } catch (e) {
      if (request === this.optionRequest) {
        this.optionReady.set(false);
        this.formError.set(apiError(e, 'No se pudieron cargar los animales.'));
      }
    } finally {
      if (request === this.optionRequest) this.optionLoading.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy() || !this.optionReady()) return;
    if (this.form.invalid) {
      this.formError.set('Selecciona el animal y completa fecha y peso.');
      return;
    }
    const v = this.form.getRawValue(),
      a = this.selected();
    if (v.date > this.today || (a?.birth_date && v.date <= a.birth_date)) {
      this.formError.set('La fecha debe ser posterior al nacimiento y no puede ser futura.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const value = await firstValueFrom(
        this.http
          .post<Weaning>(`${this.api}/weanings`, { ...v, notes: v.notes.trim() || null })
          .pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      this.optionRequest++;
      this.formOpen.set(false);
      this.success.set('Destete registrado y vinculado al historial de pesajes.');
      await this.load();
      if (!this.destroyed) this.detail.set(value);
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo registrar el destete.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async showWeights(a: AnimalOption) {
    if (this.destroyed) return;
    const request = ++this.weightRequest;
    this.weightsOpen.set(true);
    this.weights.set(null);
    this.weightsError.set('');
    this.weightsLoading.set(true);
    try {
      const value = await firstValueFrom(
        this.http
          .get<WeightHistory>(`${this.api}/weights/animals/${a.id}/history`)
          .pipe(timeout(15000)),
      );
      if (request === this.weightRequest) this.weights.set(value);
    } catch (e) {
      if (request === this.weightRequest)
        this.weightsError.set(apiError(e, 'No se pudieron consultar los pesajes.'));
    } finally {
      if (request === this.weightRequest) this.weightsLoading.set(false);
    }
  }
  protected closeWeights() {
    this.weightRequest++;
    this.weightsOpen.set(false);
  }
}
