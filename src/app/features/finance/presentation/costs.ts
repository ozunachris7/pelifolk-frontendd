import { GroupCostDistribution } from './group-cost-distribution';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { AllocationEditor, AllocationTarget } from './allocation-editor';
import { MoneyRecord, categoryLabel } from '../domain/finance';
interface Assigned {
  expense_id: string;
  allocation_id: string;
  date: string;
  category: { id: number; name: string };
  description: string | null;
  expense_amount: string;
  percentage: string;
  amount: string;
  via: string;
}
interface Page {
  as_of: string;
  kind: string;
  target: AllocationTarget;
  date_from: string | null;
  date_to: string | null;
  items: Assigned[];
  total: number;
  assigned_expenses: string;
  feeding: { total: number; unpriced_count: number; total_cost: string } | null;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-costs',
  imports: [
    GroupCostDistribution,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    AllocationEditor,
  ],
  templateUrl: './costs.html',
})
export class Costs implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionRequest = 0;
  private applied = { kind: 'animal', target_id: '', date_from: '', date_to: '' };
  protected readonly allowed = !!this.session.user()?.permissions.includes('finance:read');
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly search = this.fb.nonNullable.control('');
  protected readonly options = signal<AllocationTarget[]>([]);
  protected readonly optionError = signal('');
  protected readonly optionsLoading = signal(false);
  protected readonly distributionRevision = signal(0);
  protected readonly page = signal<Page | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<MoneyRecord | null>(null);
  protected readonly categoryLabel = categoryLabel;
  constructor() {
    if (this.allowed) void this.loadOptions();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.optionRequest++;
  }
  protected label(t: AllocationTarget) {
    return [t.name, t.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  }
  protected changeKind() {
    this.form.controls.target_id.setValue('');
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
            params: { kind: this.form.controls.kind.value, q: this.search.value.trim() },
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed || request !== this.optionRequest) return;
      const selected = this.options().find((t) => t.id === this.form.controls.target_id.value);
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
  protected apply() {
    const f = this.form.getRawValue();
    if (!f.target_id) {
      this.error.set('Selecciona un animal o lote.');
      return;
    }
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = f;
    void this.load();
  }
  protected async load(offset = 0) {
    if (!this.allowed || !this.applied.target_id) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const params = Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/finance/costs`, { params: { ...params, offset, limit: 25 } })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) {
        this.page.set(p);
        this.distributionRevision.update((v) => v + 1);
      }
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudieron consultar los costos.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected inspect(r: Assigned) {
    this.selected.set({
      id: r.expense_id,
      amount: r.expense_amount,
      date: r.date,
      description: r.description,
      category: r.category,
      supplier: null,
      sale: null,
    });
  }
  protected saved() {
    this.selected.set(null);
    void this.load();
  }
}
