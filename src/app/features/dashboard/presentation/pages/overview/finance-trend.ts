import { InteractiveChart, ChartModel } from '../../../../../shared/ui/chart/chart';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
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
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../../../core/auth/session';
import { API_URL } from '../../../../../core/http/api-url';
import { apiError } from '../../../../../core/http/api-error';

export interface FinanceMonth {
  month: string;
  income_total: string;
  expense_total: string;
  balance: string;
  income_count: number;
  expense_count: number;
}
export interface FinanceTrendData {
  as_of: string;
  date_from: string;
  date_to: string;
  currency: 'MXN';
  income_total: string;
  expense_total: string;
  movement_count: number;
  items: FinanceMonth[];
}

@Component({
  selector: 'app-finance-trend',
  imports: [InteractiveChart, CurrencyPipe, DatePipe],
  templateUrl: './finance-trend.html',
})
export class FinanceTrend implements OnDestroy {
  readonly refreshToken = input(0);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('finance:read'),
  );
  protected readonly data = signal<FinanceTrendData | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly today = this.iso(new Date());
  protected readonly from = signal(this.monthStart(6));
  protected readonly to = signal(this.today);
  protected readonly selected = signal('');
  protected readonly current = computed(
    () => this.data()?.items.find((row) => row.month === this.selected()) ?? null,
  );
  protected readonly graph = computed<ChartModel>(() => {
    const items = this.data()?.items ?? [];
    return {
      type: 'bar',
      unit: 'MXN',
      labels: items.map((row) => this.monthLabel(row.month)),
      titles: items.map((row) => this.fullMonthLabel(row.month)),
      series: [
        { label: 'Ingresos', values: items.map((row) => Number(row.income_total)) },
        { label: 'Gastos', values: items.map((row) => Number(row.expense_total)) },
      ],
    };
  });
  protected readonly selectedIndex = computed(
    () => this.data()?.items.findIndex((row) => row.month === this.selected()) ?? -1,
  );
  protected selectMonth(index: number) {
    const month = this.data()?.items[index];
    if (month) this.selected.set(month.month);
  }
  private request = 0;
  private destroyed = false;
  constructor() {
    effect(() => {
      this.refreshToken();
      const allowed = this.allowed();
      untracked(() => {
        if (allowed) void this.load();
        else {
          ++this.request;
          this.data.set(null);
          this.loading.set(false);
          this.error.set('');
        }
      });
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.request;
  }
  private iso(day: Date) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  }
  private monthStart(months: number) {
    const day = new Date();
    return this.iso(new Date(day.getFullYear(), day.getMonth() - months + 1, 1));
  }
  protected preset(months: number) {
    this.from.set(this.monthStart(months));
    this.to.set(this.today);
    void this.load();
  }
  protected async load() {
    if (!this.allowed()) return;
    const request = ++this.request;
    this.error.set('');
    this.data.set(null);
    this.selected.set('');
    this.loading.set(false);
    const start = this.from(),
      finish = this.to();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(finish) ||
      start > finish ||
      finish > this.today
    ) {
      this.error.set('Selecciona ambas fechas en orden, sin superar la fecha de hoy.');
      return;
    }
    const months =
      (Number(finish.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
      Number(finish.slice(5, 7)) -
      Number(start.slice(5, 7)) +
      1;
    if (months > 24) {
      this.error.set('Consulta un máximo de 24 meses a la vez.');
      return;
    }
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.http
          .get<FinanceTrendData>(`${this.api}/dashboard/finance-trend`, {
            params: new HttpParams().set('date_from', start).set('date_to', finish),
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) {
        this.data.set(data);
        this.selected.set(
          [...data.items].reverse().find((row) => row.income_count + row.expense_count > 0)
            ?.month ??
            data.items.at(-1)?.month ??
            '',
        );
      }
    } catch (error) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(error, 'No se pudo cargar la gráfica. Intenta de nuevo.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected fullMonthLabel(month: string) {
    const [year, number] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(
      new Date(year, number - 1, 1),
    );
  }
  protected monthLabel(month: string) {
    const [year, number] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(
      new Date(year, number - 1, 1),
    );
  }
}
