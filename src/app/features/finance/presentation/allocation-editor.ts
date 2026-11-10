import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { MoneyRecord } from '../domain/finance';
export interface AllocationTarget {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface Row {
  id: string;
  kind: string;
  target: AllocationTarget;
  percentage: string;
  amount: string;
}
interface Distribution {
  expense: { id: string; amount: string; date: string; description: string | null };
  allocations: Row[];
  assigned_amount: string;
  unassigned_amount: string;
}
export function percentUnits(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return units > 0 && units <= 10000 ? units : null;
}
@Component({
  selector: 'app-allocation-editor',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, LucideAngularModule, Modal],
  templateUrl: './allocation-editor.html',
})
export class AllocationEditor implements OnInit, OnDestroy {
  readonly expense = input.required<MoneyRecord>();
  readonly dismiss = output<void>();
  readonly saved = output<void>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionRequest = 0;
  private nextRow = 0;
  protected readonly canWrite = !!this.session.user()?.permissions.includes('finance:write');
  protected readonly canRead = !!this.session.user()?.permissions.includes('finance:read');
  protected readonly plus = Plus;
  protected readonly trash = Trash2;
  protected readonly data = signal<Distribution | null>(null);
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly options = signal<AllocationTarget[]>([]);
  protected readonly optionError = signal('');
  protected readonly optionsLoading = signal(false);
  protected readonly search = this.fb.nonNullable.control('');
  protected readonly composer = this.fb.nonNullable.group({
    kind: 'animal',
    target_id: ['', Validators.required],
    percentage: [
      '100',
      [
        Validators.required,
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
        Validators.min(0.01),
        Validators.max(100),
      ],
    ],
  });
  protected readonly kinds: Record<string, string> = {
    animal: 'Animal',
    group: 'Lote',
    health_case: 'Caso sanitario',
  };
  protected readonly total = computed(() =>
    this.rows().reduce((sum, r) => sum + (percentUnits(r.percentage) ?? 0), 0),
  );
  protected readonly valid = computed(
    () =>
      this.rows().length === 0 ||
      (this.rows().every((r) => percentUnits(r.percentage) !== null) && this.total() === 10000),
  );
  protected readonly totalLabel = computed(() => (this.total() / 100).toFixed(2));
  protected readonly previews = computed(() => {
    const rows = this.rows();
    if (!this.valid() || !rows.length) return {} as Record<string, string>;
    const [whole, fraction = ''] = (this.data()?.expense.amount || this.expense().amount).split(
      '.',
    );
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    const raw = rows.map((r) => cents * BigInt(percentUnits(r.percentage)!));
    const base = raw.map((v) => v / 10000n);
    const order = rows
      .map((_, i) => i)
      .sort((a, b) => {
        const delta = (raw[b] % 10000n) - (raw[a] % 10000n);
        return delta < 0n
          ? -1
          : delta > 0n
            ? 1
            : [rows[a].kind, rows[a].target.id].join(':') <
                [rows[b].kind, rows[b].target.id].join(':')
              ? -1
              : 1;
      });
    const remaining = Number(cents - base.reduce((a, b) => a + b, 0n));
    for (const n of order.slice(0, remaining)) base[n]++;
    return Object.fromEntries(
      rows.map((r, i) => [
        r.id,
        `${base[i] / 100n}.${(base[i] % 100n).toString().padStart(2, '0')}`,
      ]),
    );
  });
  protected label(t: AllocationTarget) {
    return [t.name, t.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  }
  ngOnInit() {
    if (this.canRead) {
      void this.load();
      if (this.canWrite) void this.loadOptions();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.optionRequest++;
  }
  protected async load() {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(
        this.http
          .get<Distribution>(`${this.api}/finance/expenses/${this.expense().id}/allocations`)
          .pipe(timeout(15000)),
      );
      if (this.destroyed || request !== this.request) return;
      this.data.set(data);
      this.rows.set(data.allocations);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo consultar la asignación.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected changeKind() {
    this.composer.controls.target_id.setValue('');
    this.search.setValue('');
    this.options.set([]);
    void this.loadOptions();
  }
  protected async loadOptions() {
    const request = ++this.optionRequest;
    this.optionsLoading.set(true);
    this.optionError.set('');
    try {
      const targets = await firstValueFrom(
        this.http
          .get<AllocationTarget[]>(`${this.api}/finance/allocation-options`, {
            params: { kind: this.composer.controls.kind.value, q: this.search.value.trim() },
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed || request !== this.optionRequest) return;
      const selected = this.options().find((t) => t.id === this.composer.controls.target_id.value);
      this.options.set(
        selected && !targets.some((t) => t.id === selected.id) ? [selected, ...targets] : targets,
      );
    } catch (e) {
      if (!this.destroyed && request === this.optionRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar los destinos.'));
    } finally {
      if (!this.destroyed && request === this.optionRequest) this.optionsLoading.set(false);
    }
  }
  protected add() {
    this.composer.markAllAsTouched();
    if (this.composer.invalid || !this.canWrite || this.busy()) return;
    const c = this.composer.getRawValue(),
      t = this.options().find((o) => o.id === c.target_id);
    if (!t) return;
    if (this.rows().some((r) => r.kind === c.kind && r.target.id === t.id)) {
      this.error.set('Este destino ya está en la asignación.');
      return;
    }
    if (this.rows().length >= 100) {
      this.error.set('Puedes asignar hasta 100 destinos.');
      return;
    }
    this.rows.update((r) => [
      ...r,
      {
        id: `new-${++this.nextRow}`,
        kind: c.kind,
        target: t,
        percentage: c.percentage,
        amount: '0.00',
      },
    ]);
    this.error.set('');
    this.composer.controls.target_id.setValue('');
    this.composer.markAsUntouched();
    this.composer.controls.percentage.setValue(
      ((10000 - this.total()) / 100 > 0 ? (10000 - this.total()) / 100 : 100).toFixed(2),
    );
  }
  protected updatePercentage(id: string, value: string) {
    if (this.canWrite && !this.busy())
      this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, percentage: value } : r)));
  }
  protected remove(id: string) {
    if (this.canWrite && !this.busy()) this.rows.update((rows) => rows.filter((r) => r.id !== id));
  }
  protected async save() {
    if (!this.canWrite || !this.valid() || this.busy() || !this.data()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http
          .put(`${this.api}/finance/expenses/${this.expense().id}/allocations`, {
            allocations: this.rows().map((r) => ({
              kind: r.kind,
              target_id: r.target.id,
              percentage: r.percentage,
            })),
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) this.saved.emit();
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo guardar la asignación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
