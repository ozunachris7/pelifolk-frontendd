import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Treatment } from '../domain/health';
interface CostPage {
  known_cost: string;
  priced_applications: number;
  unknown_applications: number;
  total: number;
  offset: number;
  status: string;
  items: {
    dose_id: string;
    date: string;
    quantity: string;
    unit_code: string;
    unit_cost: string | null;
    cost: string | null;
    effective_from: string | null;
    unknown_reason: string | null;
  }[];
}
@Component({
  selector: 'app-treatment-cost',
  imports: [CurrencyPipe, DatePipe],
  template: ` @if (canRead()) {
    <div class="my-4 border-y border-stone-200 py-4 dark:border-white/10">
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        data-treatment-cost
        class="rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
      >
        {{ open() ? 'Ocultar costo calculado' : 'Costo de aplicaciones' }}
      </button>
      @if (open()) {
        <p class="mt-3 text-xs leading-5 text-stone-500">
          Costo calculado de producto realmente aplicado, según las vigencias registradas. No
          incluye mano de obra ni equivale al gasto pagado. Las pautas sin aplicaciones no se
          valoran; no se convierten unidades.
        </p>
        @if (loading()) {
          <p class="mt-4 text-xs">Calculando…</p>
        } @else if (error()) {
          <p role="alert" class="mt-4 text-sm text-red-600">
            {{ error() }}
            <button (click)="load(page()?.offset || 0)" class="underline">Reintentar</button>
          </p>
        } @else if (page(); as p) {
          <div class="my-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p class="text-xs text-stone-500">
                {{ p.status === 'complete' ? 'Costo calculado' : 'Subtotal conocido' }}
              </p>
              <p class="mt-1 text-xl font-medium">
                {{ p.known_cost | currency: 'MXN' : 'symbol' : '1.2-2' }}
              </p>
            </div>
            <p class="text-xs text-stone-500">
              {{ p.priced_applications }} aplicaciones valoradas · {{ p.unknown_applications }} sin
              determinar
            </p>
          </div>
          @if (p.status === 'no_applications') {
            <p class="text-xs text-stone-500">
              Sin aplicaciones reales registradas. No hay un costo total determinado.
            </p>
          } @else {
            <ol class="space-y-4">
              @for (i of p.items; track i.dose_id) {
                <li class="border-t border-stone-200 pt-3 text-xs leading-6 dark:border-white/10">
                  <p>
                    {{ i.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ i.quantity }} {{ i.unit_code }}
                  </p>
                  @if (i.cost !== null) {
                    <p>
                      {{ i.unit_cost | currency: 'MXN' : 'symbol' : '1.2-2' }} / {{ i.unit_code }} ·
                      <span class="font-medium">{{
                        i.cost | currency: 'MXN' : 'symbol' : '1.2-2'
                      }}</span>
                    </p>
                    <p class="text-stone-500">
                      Precio vigente desde {{ i.effective_from | date: 'dd/MM/yyyy' : 'UTC' }}
                    </p>
                  } @else {
                    <p class="text-stone-500">
                      {{
                        i.unknown_reason === 'unit_mismatch'
                          ? 'Unidad de aplicación distinta de la unidad del producto.'
                          : 'Sin precio vigente en la fecha de aplicación.'
                      }}
                      Costo sin determinar.
                    </p>
                  }
                </li>
              }
            </ol>
          }
          <div class="mt-4 flex justify-end gap-4 text-xs">
            <button
              [disabled]="p.offset === 0"
              (click)="load(p.offset - 25)"
              class="disabled:opacity-40"
            >
              Anterior</button
            ><button
              [disabled]="p.offset + 25 >= p.total"
              (click)="load(p.offset + 25)"
              class="disabled:opacity-40"
            >
              Siguiente</button
            ><button (click)="load(p.offset)" class="underline">Actualizar</button>
          </div>
        }
      }
    </div>
  }`,
})
export class TreatmentCost implements OnDestroy {
  readonly treatment = input.required<Treatment>();
  readonly revision = input(0);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly canRead = computed(
    () =>
      !!this.session.user()?.permissions.includes('health:read') &&
      !!this.session.user()?.permissions.includes('finance:read'),
  );
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly page = signal<CostPage | null>(null);
  protected readonly error = signal('');
  private request = 0;
  private destroyed = false;
  constructor() {
    effect(() => {
      this.treatment();
      this.revision();
      if (this.open() && this.canRead()) untracked(() => void this.load());
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected toggle() {
    this.open.update((v) => !v);
    if (!this.open()) this.request++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const t = this.treatment();
    try {
      const p = await firstValueFrom(
        this.http
          .get<CostPage>(`${this.api}/health/treatments/${t.id}/products/${t.product.id}/cost`, {
            params: { offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudo calcular el costo.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
}
