import { DatePipe } from '@angular/common';
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
  status: string;
  sex: string;
  breed_id: string;
  group_id: string;
}
interface AnimalRow {
  id: string;
  name: string | null;
  siniiga: string | null;
  sex: string;
  birth_date: string | null;
  age_months: number | null;
  status: string;
  exit_date: string | null;
  group: { id: string; name: string } | null;
  breeds: { name: string; percentage: string }[];
}
interface Page {
  as_of: string;
  items: AnimalRow[];
  total: number;
  female: number;
  male: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-animal-report',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './animal-report.html',
})
export class AnimalReport implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private applied: Filters = { q: '', status: 'active', sex: '', breed_id: '', group_id: '' };
  protected readonly allowed = !!this.session.user()?.permissions.includes('animals:read');
  protected readonly download = Download;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly page = signal<Page>({
    as_of: '',
    items: [],
    total: 0,
    female: 0,
    male: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly options = signal<{
    breeds: { id: number; name: string }[];
    groups: { id: string; name: string }[];
  }>({ breeds: [], groups: [] });
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected readonly exportError = signal('');
  protected readonly optionError = signal('');
  protected readonly statusLabels: Record<string, string> = {
    active: 'Activo',
    sale: 'Venta',
    death: 'Muerte',
    slaughter: 'Sacrificio',
    transfer: 'Traspaso',
    theft: 'Robo',
    other: 'Otra salida',
  };
  constructor() {
    if (this.allowed) {
      void this.loadOptions();
      void this.load();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async loadOptions() {
    try {
      const o = await firstValueFrom(
        this.http
          .get<{ breeds: { id: number; name: string }[]; groups: { id: string; name: string }[] }>(
            `${this.api}/reports/animals/options`,
          )
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.options.set(o);
        this.optionError.set('');
      }
    } catch (e) {
      if (!this.destroyed)
        this.optionError.set(apiError(e, 'No se pudieron cargar razas y lotes.'));
    }
  }
  private params() {
    return Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
  }
  protected search() {
    this.applied = { ...this.form.getRawValue(), q: this.form.controls.q.value.trim() };
    void this.load();
  }
  protected reset() {
    this.form.reset({ q: '', status: 'active', sex: '', breed_id: '', group_id: '' });
    this.search();
  }
  protected async load(offset = 0) {
    if (!this.allowed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/reports/animals`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async export() {
    if (this.exporting() || this.loading() || !this.allowed) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const blob = await firstValueFrom(
        this.http
          .get(`${this.api}/reports/animals/export`, {
            params: this.params(),
            responseType: 'blob',
          })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-animales-${this.page().as_of}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
  protected age(months: number | null) {
    if (months === null) return 'Sin fecha';
    if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    const years = Math.floor(months / 12),
      rest = months % 12;
    return `${years} ${years === 1 ? 'año' : 'años'}${rest ? ` · ${rest} ${rest === 1 ? 'mes' : 'meses'}` : ''}`;
  }
}
