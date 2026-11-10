import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Modal } from '../../../shared/ui/modal/modal';
import { Product, ProductPrice, catalogLabel } from '../domain/health';
interface Prices {
  items: ProductPrice[];
  total: number;
  offset: number;
  current_price: ProductPrice | null;
  as_of: string;
}
@Component({
  selector: 'app-product-prices',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, Modal],
  template: ` <app-modal title="Historial de precios" [busy]="busy()" (dismiss)="dismiss.emit()"
    ><h3 class="break-words text-lg font-medium">{{ product().name }}</h3>
    <p class="mt-2 text-xs leading-5 text-stone-500">
      Precios en MXN por 1 {{ label(product().unit_code) }}. El costo calculado de aplicaciones usa
      el precio vigente en la fecha de cada dosis. Registrar un precio no registra un gasto pagado.
    </p>
    @if (canRead()) {
      @if (page(); as p) {
        <div class="my-5 border-y border-stone-200 py-4 dark:border-white/10">
          <p class="text-xs text-stone-500">
            Vigente al {{ p.as_of | date: 'dd/MM/yyyy' : 'UTC' }}
          </p>
          <p class="mt-2 text-xl font-medium">
            {{
              p.current_price
                ? (p.current_price.cost | currency: 'MXN' : 'symbol' : '1.2-2')
                : 'Sin precio vigente'
            }}<span class="text-xs font-normal text-stone-500">
              / {{ label(product().unit_code) }}</span
            >
          </p>
        </div>
      }
      @if (canWrite()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="my-6">
          <fieldset [disabled]="busy()" class="min-w-0 space-y-4">
            <h4 class="text-sm font-medium">Agregar vigencia</h4>
            <div>
              <label for="price-effective" class="mb-2 block text-xs">Vigente desde *</label
              ><input
                id="price-effective"
                type="date"
                formControlName="effective_from"
                class="w-full rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
            <div>
              <label for="price-cost" class="mb-2 block text-xs"
                >Costo por 1 {{ label(product().unit_code) }} (MXN) *</label
              ><input
                id="price-cost"
                type="number"
                formControlName="cost"
                min="0"
                max="9999999999.99"
                step="0.01"
                class="w-full rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
            <p class="text-xs leading-5 text-stone-500">
              Registra el costo unitario, no el envase completo. Una fecha futura deja el precio
              programado. Las vigencias anteriores permanecen en el historial; agregar una fecha
              pasada puede cambiar los costos calculados para aplicaciones de ese periodo.
            </p>
            @if (form.invalid && form.touched) {
              <p role="alert" class="text-sm text-red-600">
                Completa fecha y costo unitario con hasta dos decimales.
              </p>
            }
            @if (formError()) {
              <p role="alert" class="text-sm text-red-600">{{ formError() }}</p>
            }
            <button
              class="rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950"
            >
              {{ busy() ? 'Guardando…' : 'Guardar precio' }}
            </button>
          </fieldset>
        </form>
      }
      @if (success()) {
        <p role="status" class="mb-4 text-sm">{{ success() }}</p>
      }
      @if (loading()) {
        <p class="text-xs text-stone-500">Cargando precios…</p>
      } @else if (error()) {
        <p role="alert" class="text-sm text-red-600">
          {{ error() }}
          <button (click)="load(page()?.offset || 0)" class="underline">Reintentar</button>
        </p>
      } @else if (page(); as p) {
        <div class="border-t border-stone-200 dark:border-white/10">
          @for (price of p.items; track price.effective_from) {
            <div
              class="flex flex-wrap justify-between gap-3 border-b border-stone-200 py-4 text-sm dark:border-white/10"
            >
              <span
                >{{ price.effective_from | date: 'dd/MM/yyyy' : 'UTC'
                }}{{ price.effective_from > p.as_of ? ' · Programado' : '' }}</span
              ><span
                >{{ price.cost | currency: 'MXN' : 'symbol' : '1.2-2' }} /
                {{ label(product().unit_code) }}</span
              >
            </div>
          } @empty {
            <p class="py-5 text-xs text-stone-500">Sin precios registrados.</p>
          }
        </div>
        <div class="mt-5 flex justify-between text-xs">
          <span>{{ p.total }} vigencias</span>
          <div class="flex gap-4">
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
              Siguiente
            </button>
          </div>
        </div>
      }
    } @else {
      <p class="mt-5 text-sm">No tienes permiso para consultar precios.</p>
    }
  </app-modal>`,
})
export class ProductPrices implements OnInit, OnDestroy {
  readonly product = input.required<Product>();
  readonly dismiss = output<void>();
  readonly saved = output<void>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(
    () =>
      !!this.session.user()?.permissions.includes('health:read') &&
      !!this.session.user()?.permissions.includes('finance:read'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && !!this.session.user()?.permissions.includes('finance:write'),
  );
  protected readonly label = catalogLabel;
  protected readonly page = signal<Prices | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly success = signal('');
  protected readonly form = this.fb.nonNullable.group({
    effective_from: [localDate(), Validators.required],
    cost: [
      '',
      [
        Validators.required,
        Validators.min(0),
        Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
  });
  private request = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  private url() {
    return `${this.api}/health/products/${this.product().id}/prices`;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http.get<Prices>(this.url(), { params: { offset, limit: 25 } }).pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudieron consultar los precios.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(
        this.http
          .post(this.url(), {
            effective_from: v.effective_from,
            cost: String(v.cost),
            expected_unit_id: this.product().unit_id,
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      this.success.set('Precio registrado en el historial.');
      this.saved.emit();
      this.form.reset({ effective_from: localDate(), cost: '' });
      await this.load();
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar el precio.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
