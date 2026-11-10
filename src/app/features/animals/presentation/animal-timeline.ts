import { HistoryRectification } from './history-rectification';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { timeout } from 'rxjs';
import { LucideAngularModule, History } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
const labels = {
  animals: 'Datos y decisiones',
  health: 'Sanidad',
  weights: 'Pesajes y destete',
  breeding: 'Reproducción',
  locations: 'Ubicaciones',
  groups: 'Lotes',
  feeding: 'Alimentación',
  finance: 'Economía',
  exits: 'Salidas',
};
type Module = keyof typeof labels;
interface Item {
  has_rectifications?: boolean;
  id: string;
  date: string;
  kind: string;
  module: Module;
  title: string;
  details: { label: string; value: string }[];
  notes: string | null;
  recorded_by: string | null;
}
interface Page {
  items: Item[];
  total: number;
  offset: number;
  limit: number;
  modules: Module[];
  date_from: string | null;
  date_to: string | null;
}
@Component({
  selector: 'app-animal-timeline',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule, HistoryRectification],
  template: `
    <section class="mt-7 min-w-0 border-t border-stone-200 pt-5 dark:border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Historial completo</h3>
        <button
          type="button"
          (click)="opened.set(!opened())"
          [attr.aria-expanded]="opened()"
          data-testid="toggle-timeline"
          class="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
        >
          <lucide-icon [img]="history" [size]="15" />{{
            opened() ? 'Ocultar historial' : 'Ver historial'
          }}
        </button>
      </div>
      @if (opened()) {
        <p class="mt-3 text-xs leading-5 text-stone-500">
          Registros ordenados del más reciente al más antiguo. Se muestran las áreas que puedes
          consultar. El alta y los cambios de estado usan su fecha de registro; el nacimiento
          muestra la fecha guardada actualmente.
        </p>
        @if (rectificationSaved()) {
          <p role="status" class="mt-4 text-xs text-stone-500">
            Rectificación guardada. El original permanece conservado.
          </p>
        }
        <form [formGroup]="form" (ngSubmit)="search()" class="my-5 space-y-4">
          <div>
            <label for="timeline-module" class="mb-2 block text-xs">Área</label>
            <select
              id="timeline-module"
              formControlName="module"
              class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
            >
              <option value="">Todas las áreas disponibles</option>
              @for (module of modules(); track module) {
                <option [value]="module">{{ labels[module] }}</option>
              }
            </select>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="timeline-from" class="mb-2 block text-xs">Desde</label
              ><input
                id="timeline-from"
                type="date"
                formControlName="date_from"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
            <div>
              <label for="timeline-to" class="mb-2 block text-xs">Hasta</label
              ><input
                id="timeline-to"
                type="date"
                formControlName="date_to"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              class="rounded-lg bg-green-900 px-4 py-2 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              (click)="clear()"
              class="text-xs text-stone-500 underline underline-offset-4"
            >
              Limpiar
            </button>
          </div>
        </form>
        @if (validation()) {
          <p role="alert" class="mb-4 text-xs text-red-700 dark:text-red-300">{{ validation() }}</p>
        }
        @if (loading()) {
          <p role="status" class="py-6 text-xs text-stone-500">Cargando historial…</p>
        } @else if (error()) {
          <p role="alert" class="text-xs text-red-700 dark:text-red-300">
            {{ error() }}
            <button type="button" (click)="retry.update(increment)" class="underline">
              Reintentar
            </button>
          </p>
        } @else if (page(); as p) {
          <p class="mb-5 text-xs text-stone-500">
            {{ p.total }} registros en los filtros aplicados.
          </p>
          <ol class="space-y-6 border-l border-stone-200 pl-4 dark:border-white/15">
            @for (entry of p.items; track entry.id) {
              <li data-timeline-item class="min-w-0">
                <p class="text-xs text-stone-500">
                  {{ entry.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ labels[entry.module] }}
                </p>
                <h4 class="mt-1 text-sm font-medium">{{ entry.title }}</h4>
                @if (entry.details.length) {
                  <dl class="mt-3 space-y-2 text-xs">
                    @for (d of entry.details; track $index) {
                      <div class="min-w-0">
                        <dt class="text-stone-500">{{ d.label }}</dt>
                        <dd class="mt-1 break-words">{{ d.value }}</dd>
                      </div>
                    }
                  </dl>
                }
                @if (entry.notes) {
                  <p class="mt-3 whitespace-pre-wrap break-words text-xs leading-5">
                    {{ entry.notes }}
                  </p>
                }
                @if (entry.recorded_by) {
                  <p class="mt-2 text-xs text-stone-500">Registrado por {{ entry.recorded_by }}</p>
                }
                <app-history-rectification
                  [animalId]="animalId()"
                  [entryId]="entry.id"
                  [hasRectifications]="!!entry.has_rectifications"
                  (saved)="rectificationSaved.set(true); retry.update(increment)"
                  (refreshRequested)="retry.update(increment)"
                />
              </li>
            } @empty {
              <li class="py-5 text-xs text-stone-500">
                No hay registros en los filtros aplicados.
              </li>
            }
          </ol>
          @if (p.total > p.limit) {
            <div class="mt-6 flex flex-wrap items-center justify-end gap-4 text-xs text-stone-500">
              <span
                >{{ p.total ? p.offset + 1 : 0 }}–{{ p.offset + p.items.length }} de
                {{ p.total }}</span
              >
              <button
                type="button"
                (click)="offset.set(p.offset - p.limit)"
                [disabled]="p.offset === 0"
                class="disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                (click)="offset.set(p.offset + p.limit)"
                [disabled]="p.offset + p.limit >= p.total"
                class="disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          }
        }
      }
    </section>
  `,
})
export class AnimalTimeline {
  readonly animalId = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  protected readonly labels = labels;
  protected readonly history = History;
  protected readonly rectificationSaved = signal(false);
  protected readonly modules = computed(() =>
    (Object.keys(labels) as Module[]).filter((m) =>
      this.session.user()?.permissions.includes(m + ':read'),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({ module: '', date_from: '', date_to: '' });
  protected readonly opened = signal(false);
  protected readonly offset = signal(0);
  protected readonly page = signal<Page | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly validation = signal('');
  protected readonly retry = signal(0);
  protected readonly increment = (v: number) => v + 1;
  private readonly applied = signal({ module: '', date_from: '', date_to: '' });
  constructor() {
    effect((cleanup) => {
      const id = this.animalId(),
        opened = this.opened(),
        f = this.applied(),
        offset = this.offset();
      this.retry();
      this.page.set(null);
      this.error.set('');
      this.loading.set(false);
      if (!opened || !this.session.user()?.permissions.includes('animals:read')) return;
      this.loading.set(true);
      const params = {
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')),
        offset,
        limit: 25,
      };
      const sub = this.http
        .get<Page>(`${this.api}/animals/${id}/timeline`, { params })
        .pipe(timeout(15000))
        .subscribe({
          next: (page) => {
            this.page.set(page);
            this.loading.set(false);
          },
          error: (error) => {
            this.error.set(apiError(error, 'No se pudo cargar el historial.'));
            this.loading.set(false);
          },
        });
      cleanup(() => sub.unsubscribe());
    });
  }
  protected search() {
    const f = this.form.getRawValue();
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.validation.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.validation.set('');
    this.offset.set(0);
    this.applied.set(f);
  }
  protected clear() {
    this.form.reset({ module: '', date_from: '', date_to: '' });
    this.search();
  }
}
