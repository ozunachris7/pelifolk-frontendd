import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Download } from 'lucide-angular';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { apiError } from '../../core/http/api-error';
import {
  MoneyRecord,
  Summary,
  Category,
  categoryLabel,
  saleLabel,
} from '../finance/domain/finance';
interface Filters {
  kind: string;
  q: string;
  category_id: string;
  supplier_id: string;
  date_from: string;
  date_to: string;
}
interface Supplier {
  id: string;
  name: string;
  active: boolean;
}
interface Options {
  expense_categories: Category[];
  income_categories: Category[];
  suppliers: Supplier[];
}
interface Page {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  kind: string;
  items: MoneyRecord[];
  total: number;
  filtered_total: string;
  summary: Summary;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-finance-report',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './finance-report.html',
})
export class FinanceReport implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionsRequest = 0;
  private readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  private applied: Filters = {
    kind: 'expense',
    q: '',
    category_id: '',
    supplier_id: '',
    date_from: this.today.slice(0, 8) + '01',
    date_to: this.today,
  };
  protected readonly allowed = !!this.session.user()?.permissions.includes('finance:read');
  protected readonly tab = signal('expense');
  protected readonly download = Download;
  protected readonly categoryLabel = categoryLabel;
  protected readonly saleLabel = saleLabel;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly supplierSearch = this.fb.nonNullable.control('');
  protected readonly page = signal<Page>({
    as_of: '',
    date_from: null,
    date_to: null,
    kind: 'expense',
    items: [],
    total: 0,
    filtered_total: '0.00',
    summary: {
      income_total: '0.00',
      expense_total: '0.00',
      balance: '0.00',
      income_count: 0,
      expense_count: 0,
    },
    offset: 0,
    limit: 25,
  });
  protected readonly options = signal<Options>({
    expense_categories: [],
    income_categories: [],
    suppliers: [],
  });
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly optionsLoading = signal(false);
  protected readonly error = signal('');
  protected readonly exportError = signal('');
  protected readonly optionError = signal('');
  constructor() {
    if (this.allowed) {
      void this.loadOptions();
      void this.load();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.optionsRequest++;
  }
  protected switchTab(kind: string) {
    if (this.tab() === kind) return;
    this.tab.set(kind);
    this.form.patchValue({ kind, category_id: '', supplier_id: '' });
    this.search();
  }
  protected reset() {
    this.form.reset({
      kind: this.tab(),
      q: '',
      category_id: '',
      supplier_id: '',
      date_from: this.today.slice(0, 8) + '01',
      date_to: this.today,
    });
    this.search();
  }
  protected search() {
    const f = this.form.getRawValue();
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = { ...f, kind: this.tab(), q: f.q.trim() };
    void this.load();
  }
  private params() {
    return Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
  }
  protected async loadOptions() {
    const request = ++this.optionsRequest;
    this.optionsLoading.set(true);
    try {
      const o = await firstValueFrom(
        this.http
          .get<Options>(`${this.api}/reports/finance/options`, {
            params: { supplier_q: this.supplierSearch.value.trim() },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.optionsRequest) {
        const selected = this.options().suppliers.find(
          (s) => s.id === this.form.controls.supplier_id.value,
        );
        if (selected && !o.suppliers.some((s) => s.id === selected.id))
          o.suppliers.unshift(selected);
        this.options.set(o);
        this.optionError.set('');
      }
    } catch (e) {
      if (!this.destroyed && request === this.optionsRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar categorías y proveedores.'));
    } finally {
      if (!this.destroyed && request === this.optionsRequest) this.optionsLoading.set(false);
    }
  }
  protected async load(offset = 0) {
    if (!this.allowed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/reports/finance`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte económico.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async export() {
    if (this.exporting() || this.loading() || !this.allowed || this.error()) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const kind = this.applied.kind,
        asOf = this.page().as_of;
      const blob = await firstValueFrom(
        this.http
          .get(`${this.api}/reports/finance/export`, {
            params: this.params(),
            responseType: 'blob',
          })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-economia-${kind}-${asOf}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
}
