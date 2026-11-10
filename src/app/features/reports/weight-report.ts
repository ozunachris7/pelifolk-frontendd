import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Download } from 'lucide-angular';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { apiError } from '../../core/http/api-error';
interface Filters {
  q: string;
  animal_id: string;
  date_from: string;
  date_to: string;
}
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface Measurement {
  id: string;
  animal: Animal;
  date: string;
  weight_kg: string;
  previous_date: string | null;
  previous_weight_kg: string | null;
  days: number | null;
  gain_kg: string | null;
  daily_gain_kg: string | null;
  notes: string | null;
  recorded_by: string;
}
interface Page {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  items: Measurement[];
  total: number;
  animal_count: number;
  comparable_count: number;
  loss_count: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-weight-report',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './weight-report.html',
})
export class WeightReport implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionsRequest = 0;
  private applied: Filters = {
    q: '',
    animal_id: '',
    date_from: '',
    date_to: '',
  };
  protected readonly allowed = !!this.session.user()?.permissions.includes('weights:read');
  protected readonly download = Download;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly animalSearch = this.fb.nonNullable.control('');
  protected readonly page = signal<Page>({
    as_of: '',
    items: [],
    total: 0,
    date_from: null,
    date_to: null,
    animal_count: 0,
    comparable_count: 0,
    loss_count: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly options = signal<Animal[]>([]);
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
  protected reset() {
    this.form.reset({ q: '', animal_id: '', date_from: '', date_to: '' });
    this.animalSearch.setValue('');
    void this.loadOptions();
    this.search();
  }
  protected label(a: Animal) {
    return [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  }
  protected search() {
    const f = this.form.getRawValue();
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = { ...f, q: f.q.trim() };
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
          .get<{ animals: Animal[] }>(`${this.api}/reports/weights/options`, {
            params: { animal_q: this.animalSearch.value.trim() },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.optionsRequest) {
        const selected = this.options().find((a) => a.id === this.form.controls.animal_id.value);
        if (selected && !o.animals.some((a) => a.id === selected.id)) o.animals.unshift(selected);
        this.options.set(o.animals);
        this.optionError.set('');
      }
    } catch (e) {
      if (!this.destroyed && request === this.optionsRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar los animales.'));
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
          .get<Page>(`${this.api}/reports/weights`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte de pesajes.'));
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
          .get(`${this.api}/reports/weights/export`, {
            params: this.params(),
            responseType: 'blob',
          })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-pesajes-${asOf}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
}
