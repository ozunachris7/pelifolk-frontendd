import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Download } from 'lucide-angular';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { apiError } from '../../core/http/api-error';
import { Consumption, Target, unitLabel, targetLabel } from '../feeding/domain/feeding';
interface Filters {
  q: string;
  feed_id: string;
  target_kind: string;
  target_id: string;
  date_from: string;
  date_to: string;
}
interface FeedOption {
  id: string;
  name: string;
  unit_code: string;
}
interface Options {
  feeds: FeedOption[];
  targets: Target[];
}
interface Page {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  items: Consumption[];
  total: number;
  total_cost: string;
  unpriced_count: number;
  quantities: { unit_code: string; quantity: string }[];
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-feeding-report',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './feeding-report.html',
})
export class FeedingReport implements OnDestroy {
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
    q: '',
    feed_id: '',
    target_kind: 'all',
    target_id: '',
    date_from: this.today.slice(0, 8) + '01',
    date_to: this.today,
  };
  protected readonly allowed = !!this.session.user()?.permissions.includes('feeding:read');
  protected readonly download = Download;
  protected readonly unitLabel = unitLabel;
  protected readonly label = targetLabel;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly feedSearch = this.fb.nonNullable.control('');
  protected readonly targetSearch = this.fb.nonNullable.control('');
  protected readonly page = signal<Page>({
    as_of: '',
    date_from: null,
    date_to: null,
    items: [],
    total: 0,
    total_cost: '0.00',
    unpriced_count: 0,
    quantities: [],
    offset: 0,
    limit: 25,
  });
  protected readonly options = signal<Options>({ feeds: [], targets: [] });
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
  protected changeKind() {
    this.form.controls.target_id.setValue('');
    this.targetSearch.setValue('');
    this.options.update((o) => ({ ...o, targets: [] }));
    void this.loadOptions();
  }
  protected reset() {
    this.form.reset({
      q: '',
      feed_id: '',
      target_kind: 'all',
      target_id: '',
      date_from: this.today.slice(0, 8) + '01',
      date_to: this.today,
    });
    this.feedSearch.setValue('');
    this.targetSearch.setValue('');
    void this.loadOptions();
    this.search();
  }
  protected search() {
    const f = this.form.getRawValue();
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = { ...f, target_id: f.target_kind === 'all' ? '' : f.target_id, q: f.q.trim() };
    void this.load();
  }
  private params() {
    return Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
  }
  protected async loadOptions() {
    const request = ++this.optionsRequest;
    this.optionsLoading.set(true);
    const kind = this.form.controls.target_kind.value === 'group' ? 'group' : 'animal';
    try {
      const o = await firstValueFrom(
        this.http
          .get<Options>(`${this.api}/reports/feeding/options`, {
            params: {
              feed_q: this.feedSearch.value.trim(),
              target_q: this.targetSearch.value.trim(),
              target_kind: kind,
            },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.optionsRequest) {
        const feed = this.options().feeds.find((s) => s.id === this.form.controls.feed_id.value),
          target = this.options().targets.find((s) => s.id === this.form.controls.target_id.value);
        if (feed && !o.feeds.some((s) => s.id === feed.id)) o.feeds.unshift(feed);
        if (target && !o.targets.some((s) => s.id === target.id)) o.targets.unshift(target);
        this.options.set(o);
        this.optionError.set('');
      }
    } catch (e) {
      if (!this.destroyed && request === this.optionsRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar alimentos y destinos.'));
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
          .get<Page>(`${this.api}/reports/feeding`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte de alimentación.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async export() {
    if (this.exporting() || this.loading() || !this.allowed || this.error()) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const asOf = this.page().as_of;
      const blob = await firstValueFrom(
        this.http
          .get(`${this.api}/reports/feeding/export`, {
            params: this.params(),
            responseType: 'blob',
          })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-alimentacion-${asOf}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
}
