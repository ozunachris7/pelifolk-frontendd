import { Component, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Animal } from '../domain/animal';
const kinds = [
  ['retain_breeding', 'Conservar para reproducción'],
  ['exclude_breeding', 'Descartar para reproducción'],
  ['separate', 'Separar del resto del hato'],
  ['sale_planned', 'Venta prevista'],
  ['purchase_reason', 'Motivo de compra'],
  ['other', 'Otra decisión'],
] as const;
type Kind = (typeof kinds)[number][0];
interface Decision {
  id: string;
  date: string;
  kind: Kind;
  reason: string;
  recorded_by: string;
  created_at: string;
}
interface DecisionPage {
  items: Decision[];
  total: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-animal-decisions',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule],
  template: `
    <section class="mt-7 min-w-0 border-t border-stone-200 pt-5 dark:border-white/10">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Decisiones e historial</h3>
        @if (canWrite() && !open()) {
          <button
            type="button"
            data-testid="new-decision"
            (click)="start()"
            class="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
          >
            <lucide-icon [img]="plus" [size]="15" aria-hidden="true" />Registrar decisión
          </button>
        }
      </div>
      @if (open()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="mb-6">
          <fieldset [disabled]="busy()" class="min-w-0 space-y-4">
            <div>
              <label for="decision-date" class="mb-2 block text-xs">Fecha de la decisión *</label
              ><input
                id="decision-date"
                type="date"
                formControlName="date"
                [min]="animal().birth_date || ''"
                [max]="animal().exit_date || today"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
            <div>
              <label for="decision-kind" class="mb-2 block text-xs">Tipo de decisión *</label
              ><select
                id="decision-kind"
                formControlName="kind"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
              >
                @for (k of kinds; track k[0]) {
                  <option [value]="k[0]">{{ k[1] }}</option>
                }
              </select>
            </div>
            <div>
              <label for="decision-reason" class="mb-2 block text-xs"
                >Motivo y criterios considerados *</label
              ><textarea
                id="decision-reason"
                formControlName="reason"
                rows="4"
                maxlength="5000"
                placeholder="Explica qué se decidió y en qué información te basaste."
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              ></textarea>
            </div>
            <p class="text-xs text-stone-500">
              Aquí documentas el motivo de la decisión. Para aplicar cambios: usa Editar animal para
              reproductores, Ubicaciones o Lotes para separaciones y Salidas para ventas.
            </p>
            <p class="text-xs text-stone-500">
              La última decisión por fecha de conservar, descartar, separar o prever venta aparece en Decisiones vigentes. Motivo de compra y Otra decisión son antecedentes y no la sustituyen. Cada decisión permanece en el historial. Para aclararla o cambiar el criterio, agrega
              un nuevo registro.
            </p>
            @if (formError()) {
              <p role="alert" class="text-sm text-red-600">{{ formError() }}</p>
            }
            <div class="flex flex-wrap justify-end gap-3">
              <button type="button" (click)="open.set(false)" class="px-3 py-3 text-xs">
                Cancelar</button
              ><button type="submit" class="rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950">
                {{ busy() ? 'Guardando…' : 'Guardar decisión' }}
              </button>
            </div>
          </fieldset>
        </form>
      }
      @if (success()) {
        <p role="status" class="mb-4 text-sm text-green-800 dark:text-green-200">{{ success() }}</p>
      }
      <div class="mb-4 flex flex-wrap items-center gap-3 text-xs">
        <label for="decision-filter">Mostrar</label
        ><select
          id="decision-filter"
          [value]="filter()"
          (change)="filter.set($any($event.target).value); load()"
          class="min-w-0 max-w-full rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-[#171717]"
        >
          <option value="">Todas las decisiones</option>
          @for (k of kinds; track k[0]) {
            <option [value]="k[0]">{{ k[1] }}</option>
          }
        </select>
      </div>
      @if (error()) {
        <p role="alert" class="mb-4 text-sm text-red-600">
          {{ error() }}
          <button type="button" (click)="load(page().offset)" class="underline">Reintentar</button>
        </p>
      }
      @if (loading()) {
        <p class="py-5 text-xs text-stone-500">Cargando decisiones…</p>
      } @else if (!error()) {
        <ol class="space-y-5 border-l border-stone-200 pl-4 dark:border-white/10">
          @for (d of page().items; track d.id) {
            <li data-decision-entry>
              <p class="mb-2 text-xs text-stone-500">
                {{ d.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ d.recorded_by }}
              </p>
              <h4 class="text-sm font-medium">{{ label(d.kind) }}</h4>
              <p class="mt-2 whitespace-pre-wrap break-words text-sm">{{ d.reason }}</p>
            </li>
          } @empty {
            <li class="text-xs text-stone-500">Sin decisiones registradas con este filtro.</li>
          }
        </ol>
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>{{ page().total }} registros</span>
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
    </section>
  `,
})
export class AnimalDecisions implements OnInit, OnDestroy {
  readonly animal = input.required<Animal>();
  readonly canWrite = input(false);
  readonly busyChange = output<boolean>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  protected readonly kinds = kinds;
  protected readonly plus = Plus;
  protected readonly label = (kind: Kind) =>
    kinds.find((k) => k[0] === kind)?.[1] || 'Otra decisión';
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly success = signal('');
  protected readonly filter = signal<Kind | ''>('');
  protected readonly page = signal<DecisionPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected readonly form = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    kind: ['other' as Kind, Validators.required],
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
  });
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async load(offset = 0) {
    if (this.destroyed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const value = await firstValueFrom(
        this.http
          .get<DecisionPage>(`${this.api}/animals/${this.animal().id}/decisions`, {
            params: { offset, limit: 25, ...(this.filter() ? { kind: this.filter() } : {}) },
          })
          .pipe(timeout(15000)),
      );
      if (request === this.request) this.page.set(value);
    } catch (e) {
      if (request === this.request)
        this.error.set(apiError(e, 'No se pudieron consultar las decisiones.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected start() {
    if (!this.canWrite() || this.busy()) return;
    this.form.reset({ date: this.animal().exit_date || this.today, kind: 'other', reason: '' });
    this.formError.set('');
    this.success.set('');
    this.open.set(true);
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy()) return;
    if (this.form.invalid) {
      this.formError.set('Completa la fecha, el tipo y el motivo de la decisión.');
      return;
    }
    const v = this.form.getRawValue();
    if (v.date > this.today || (this.animal().birth_date && v.date < this.animal().birth_date!)) {
      this.formError.set('La fecha debe estar entre el nacimiento del animal y hoy.');
      return;
    }
    if (this.animal().exit_date && v.date > this.animal().exit_date!) {
      this.formError.set('La decisión no puede quedar después de la salida del animal.');
      return;
    }
    this.busy.set(true);
    this.busyChange.emit(true);
    this.formError.set('');
    try {
      await firstValueFrom(
        this.http
          .post<Decision>(`${this.api}/animals/${this.animal().id}/decisions`, {
            ...v,
            reason: v.reason.trim(),
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      this.open.set(false);
      this.success.set('Decisión guardada en el historial.');
      this.filter.set('');
      await this.load();
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar la decisión.'));
    } finally {
      if (!this.destroyed) {
        this.busy.set(false);
        this.busyChange.emit(false);
      }
    }
  }
}
