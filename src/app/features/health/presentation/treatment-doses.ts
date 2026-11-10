import { TreatmentCost } from './treatment-cost';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Syringe, Plus } from 'lucide-angular';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Treatment, TreatmentCatalogs, catalogLabel } from '../domain/health';
interface Dose {
  id: string;
  applied_at: string;
  administered_by: string;
  dose_value: string;
  dose_unit_code: string;
  route_name: string;
  notes: string | null;
  is_deviation: boolean;
  recorded_by: string;
}
interface Page {
  items: Dose[];
  total: number;
  offset: number;
  limit: number;
}
function localInput(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function applicationTimestamp(value: string) {
  const d = new Date(value),
    offset = -d.getTimezoneOffset(),
    sign = offset < 0 ? '-' : '+';
  return `${localInput(d)}:00${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
}
@Component({
  selector: 'app-treatment-doses',
  imports: [ReactiveFormsModule, LucideAngularModule, TreatmentCost],
  template: `
    <div class="mt-4 min-w-0 border-t border-stone-200 pt-3 dark:border-white/10">
      <button
        type="button"
        (click)="toggle()"
        [disabled]="busy()"
        [attr.aria-expanded]="expanded()"
        data-dose-ledger
        class="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
      >
        <lucide-icon [img]="syringe" [size]="15" />{{
          expanded() ? 'Ocultar dosis aplicadas' : 'Dosis aplicadas'
        }}
      </button>
      @if (expanded()) {
        <p class="mt-3 text-xs leading-5 text-stone-500">
          La pauta indicada y las aplicaciones reales son registros separados. Aquí se capturan
          únicamente las dosis que se aplicaron.
        </p>
        <app-treatment-cost [treatment]="treatment()" [revision]="costRevision()" />
        @if (allowed() && !formOpen()) {
          <button
            type="button"
            (click)="start()"
            [disabled]="busy()"
            data-new-dose
            class="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-900 px-3 py-2 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950"
          >
            <lucide-icon [img]="plus" [size]="14" />Registrar dosis aplicada
          </button>
        }
        @if (formOpen()) {
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-5 space-y-4">
            <fieldset [disabled]="busy() || catalogLoading()" class="min-w-0 space-y-4">
              <div>
                <label [for]="id('time')" class="mb-2 block text-xs"
                  >Fecha y hora de aplicación *</label
                ><input
                  [id]="id('time')"
                  data-dose-time
                  type="datetime-local"
                  step="60"
                  formControlName="applied_at"
                  [max]="now"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                />
                <p class="mt-2 text-xs text-stone-500">Hora local de la aplicación.</p>
              </div>
              <div>
                <label [for]="id('responsible')" class="mb-2 block text-xs">Aplicada por *</label
                ><input
                  [id]="id('responsible')"
                  data-dose-responsible
                  formControlName="administered_by"
                  maxlength="190"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                />
                <p class="mt-2 text-xs text-stone-500">
                  Indica quién la aplicó. Tu sesión identificará por separado quién captura el
                  registro.
                </p>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label [for]="id('quantity')" class="mb-2 block text-xs"
                    >Cantidad aplicada *</label
                  ><input
                    [id]="id('quantity')"
                    data-dose-quantity
                    type="number"
                    min="0.001"
                    max="9999999.999"
                    step="0.001"
                    formControlName="dose_value"
                    class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                  />
                </div>
                <div>
                  <label [for]="id('unit')" class="mb-2 block text-xs">Unidad *</label
                  ><select
                    [id]="id('unit')"
                    formControlName="dose_unit_id"
                    class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
                  >
                    @for (u of catalogs()?.units ?? []; track u.id) {
                      <option [ngValue]="u.id">{{ label(u.code) }}</option>
                    }
                  </select>
                </div>
              </div>
              <div>
                <label [for]="id('route')" class="mb-2 block text-xs">Vía utilizada *</label
                ><select
                  [id]="id('route')"
                  formControlName="route_id"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
                >
                  @for (r of catalogs()?.routes ?? []; track r.id) {
                    <option [ngValue]="r.id">{{ label(r.name) }}</option>
                  }
                </select>
              </div>
              <p class="text-xs leading-5 text-stone-500">
                Pauta indicada: {{ treatment().dose_value }}
                {{ label(treatment().dose_unit_code) }} · {{ label(treatment().route_name) }}. No se
                modifica al guardar una aplicación.
              </p>
              <div>
                <label [for]="id('notes')" class="mb-2 block text-xs"
                  >Notas de aplicación {{ variation() ? '*' : '' }}</label
                ><textarea
                  [id]="id('notes')"
                  data-dose-notes
                  formControlName="notes"
                  maxlength="5000"
                  rows="3"
                  class="w-full rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                ></textarea>
              </div>
              @if (variation()) {
                <p class="text-xs leading-5 text-amber-700 dark:text-amber-300">
                  La aplicación difiere en fecha, cantidad, unidad o vía de la pauta. Explica la
                  variación en las notas.
                </p>
              }
              <div class="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  (click)="formOpen.set(false)"
                  class="rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
                >
                  Cancelar</button
                ><button
                  type="submit"
                  [disabled]="!catalogs() || busy()"
                  class="rounded-lg bg-green-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950"
                >
                  {{ busy() ? 'Guardando…' : 'Guardar aplicación' }}
                </button>
              </div>
            </fieldset>
            @if (catalogLoading()) {
              <p role="status" class="text-xs text-stone-500">Cargando unidades y vías…</p>
            }
            @if (error()) {
              <p role="alert" class="text-xs text-red-700 dark:text-red-300">{{ error() }}</p>
            }
          </form>
        }
        @if (loading()) {
          <p role="status" class="py-4 text-xs text-stone-500">Cargando aplicaciones…</p>
        } @else if (listError()) {
          <p role="alert" class="mt-4 text-xs text-red-700 dark:text-red-300">
            {{ listError() }}
            <button type="button" (click)="load(offset())" class="underline">Reintentar</button>
          </p>
        } @else if (page(); as p) {
          <p class="mt-5 text-xs text-stone-500">
            {{ p.total }} {{ p.total === 1 ? 'dosis registrada' : 'dosis registradas' }}.
          </p>
          <ol class="mt-4 space-y-5 border-l border-stone-200 pl-3 dark:border-white/15">
            @for (d of p.items; track d.id) {
              <li data-dose-entry>
                <p class="text-xs font-medium">{{ applicationLabel(d.applied_at) }}</p>
                <p class="mt-2 text-sm">
                  {{ d.dose_value }} {{ label(d.dose_unit_code) }} · {{ label(d.route_name) }}
                </p>
                <p class="mt-2 text-xs">Aplicada por {{ d.administered_by }}</p>
                <p class="mt-1 text-xs text-stone-500">Capturada por {{ d.recorded_by }}</p>
                @if (d.is_deviation) {
                  <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Variación de pauta registrada
                  </p>
                }
                @if (d.notes) {
                  <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5">
                    {{ d.notes }}
                  </p>
                }
              </li>
            } @empty {
              <li class="text-xs text-stone-500">
                Sin dosis aplicadas registradas. La pauta por sí sola no confirma su aplicación.
              </li>
            }
          </ol>
          @if (p.total > p.limit) {
            <div class="mt-5 flex flex-wrap justify-end gap-4 text-xs text-stone-500">
              <span>{{ p.offset + 1 }}–{{ p.offset + p.items.length }} de {{ p.total }}</span
              ><button
                type="button"
                (click)="offset.set(p.offset - p.limit)"
                [disabled]="p.offset === 0 || busy()"
                class="disabled:opacity-50"
              >
                Anterior</button
              ><button
                type="button"
                (click)="offset.set(p.offset + p.limit)"
                [disabled]="p.offset + p.limit >= p.total || busy()"
                class="disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          }
        }
      }
    </div>
  `,
})
export class TreatmentDoses implements OnDestroy {
  readonly treatment = input.required<Treatment>();
  readonly canWrite = input(false);
  readonly busyChange = output<boolean>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  protected readonly syringe = Syringe;
  protected readonly plus = Plus;
  protected readonly label = catalogLabel;
  protected readonly allowed = computed(
    () =>
      this.canWrite() &&
      !!this.session.user()?.permissions.includes('health:read') &&
      !!this.session.user()?.permissions.includes('health:doses:create'),
  );
  protected readonly costRevision = signal(0);
  protected readonly expanded = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly offset = signal(0);
  protected readonly page = signal<Page | null>(null);
  protected readonly loading = signal(false);
  protected readonly listError = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly catalogs = signal<TreatmentCatalogs | null>(null);
  protected readonly catalogLoading = signal(false);
  protected now = localInput();
  protected readonly form = this.fb.nonNullable.group({
    applied_at: ['', Validators.required],
    administered_by: [
      '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(190)],
    ],
    dose_value: [
      '',
      [
        Validators.required,
        Validators.min(0.001),
        Validators.max(9999999.999),
        Validators.pattern(/^\d+(\.\d{1,3})?$/),
      ],
    ],
    dose_unit_id: [0, Validators.min(1)],
    route_id: [0, Validators.min(1)],
    notes: ['', Validators.maxLength(5000)],
  });
  constructor() {
    effect(() => {
      this.treatment();
      const expanded = this.expanded(),
        offset = this.offset();
      if (expanded) void this.load(offset);
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected id(field: string) {
    return `dose-${this.treatment().id}-${this.treatment().product.id}-${field}`;
  }
  private url() {
    const t = this.treatment();
    return `${this.api}/health/treatments/${t.id}/products/${t.product.id}/doses`;
  }
  protected toggle() {
    if (this.busy()) return;
    this.expanded.update((v) => !v);
    if (!this.expanded()) {
      this.request++;
      this.formOpen.set(false);
    }
  }
  protected applicationLabel(value: string) {
    const suffix = value.slice(19) === 'Z' ? '+00:00' : value.slice(19);
    return `${value.slice(0, 10).split('-').reverse().join('/')} ${value.slice(11, 16)} (UTC${suffix})`;
  }
  protected async load(offset = 0) {
    const request = ++this.request;
    this.loading.set(true);
    this.listError.set('');
    try {
      const page = await firstValueFrom(
        this.http.get<Page>(this.url(), { params: { offset, limit: 25 } }).pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(page);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.listError.set(apiError(e, 'No se pudieron cargar las dosis.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async start() {
    if (!this.allowed() || this.busy()) return;
    this.now = localInput();
    const t = this.treatment(),
      u = this.session.user();
    this.form.reset({
      applied_at: this.now,
      administered_by: [u?.name, u?.middle_name, u?.paternal_lastname, u?.maternal_lastname]
        .filter(Boolean)
        .join(' '),
      dose_value: '',
      dose_unit_id: t.dose_unit_id,
      route_id: t.route_id,
      notes: '',
    });
    this.error.set('');
    this.formOpen.set(true);
    this.offset.set(0);
    if (this.catalogs()) return;
    this.catalogLoading.set(true);
    try {
      const catalogs = await firstValueFrom(
        this.http.get<TreatmentCatalogs>(`${this.api}/health/catalogs`).pipe(timeout(15000)),
      );
      if (!this.destroyed) this.catalogs.set(catalogs);
    } catch (e) {
      if (!this.destroyed)
        this.error.set(apiError(e, 'No se pudieron cargar las unidades y vías.'));
    } finally {
      if (!this.destroyed) this.catalogLoading.set(false);
    }
  }
  protected variation() {
    const v = this.form.getRawValue(),
      t = this.treatment();
    return (
      !!v.applied_at &&
      (v.applied_at.slice(0, 10) < t.start_date ||
        v.applied_at.slice(0, 10) > t.last_day ||
        (v.dose_value !== '' && Number(v.dose_value) !== Number(t.dose_value)) ||
        v.dose_unit_id !== t.dose_unit_id ||
        v.route_id !== t.route_id)
    );
  }
  protected async save() {
    if (!this.allowed() || this.busy() || !this.catalogs()) return;
    this.form.markAllAsTouched();
    const v = this.form.getRawValue(),
      instant = new Date(v.applied_at);
    this.error.set('');
    if (this.form.invalid || !Number.isFinite(instant.getTime())) {
      this.error.set(
        'Completa la fecha y hora, cantidad, unidad, vía y persona que aplicó la dosis.',
      );
      return;
    }
    if (instant.getTime() > Date.now()) {
      this.error.set('La fecha y hora de aplicación no pueden ser futuras.');
      return;
    }
    if (this.variation() && !v.notes.trim()) {
      this.error.set('Explica en las notas la variación respecto de la pauta.');
      return;
    }
    this.busy.set(true);
    this.busyChange.emit(true);
    try {
      await firstValueFrom(
        this.http
          .post<Dose>(this.url(), {
            ...v,
            applied_at: applicationTimestamp(v.applied_at),
            dose_value: String(v.dose_value),
            administered_by: v.administered_by.trim(),
            notes: v.notes.trim() || null,
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      this.formOpen.set(false);
      this.costRevision.update((v) => v + 1);
      await this.load(0);
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo registrar la dosis aplicada.'));
    } finally {
      if (!this.destroyed) {
        this.busy.set(false);
        this.busyChange.emit(false);
      }
    }
  }
}
