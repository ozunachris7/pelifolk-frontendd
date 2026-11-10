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
  kind: string;
  q: string;
  animal_id: string;
  result: string;
  date_from: string;
  date_to: string;
}
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
  sex: string;
}
interface Child {
  animal: Animal;
  alive: boolean;
  birth_weight_kg: string | null;
}
interface Event {
  id: string;
  kind: string;
  animal: Animal;
  date: string;
  notes: string | null;
  recorded_by: string;
  male: Animal | null;
  result: string | null;
  mating_event_id: string | null;
  birth_type: string | null;
  offspring: Child[];
}
interface Page {
  as_of: string;
  kind: string;
  items: Event[];
  total: number;
  counts: Record<string, number>;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-breeding-report',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './breeding-report.html',
})
export class BreedingReport implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionsRequest = 0;
  private applied: Filters = {
    kind: 'mating',
    q: '',
    animal_id: '',
    result: '',
    date_from: '',
    date_to: '',
  };
  protected readonly allowed = !!this.session.user()?.permissions.includes('breeding:read');
  protected readonly tab = signal('mating');
  protected readonly download = Download;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly animalSearch = this.fb.nonNullable.control('');
  protected readonly page = signal<Page>({
    as_of: '',
    kind: 'mating',
    items: [],
    total: 0,
    counts: {},
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
  protected readonly results: Record<string, string> = {
    pregnant: 'Gestante',
    not_pregnant: 'Vacía',
    uncertain: 'Dudosa',
  };
  protected readonly birthTypes: Record<string, string> = {
    natural: 'Natural',
    assisted: 'Asistido',
    cesarean: 'Cesárea',
    other: 'Otro',
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
    this.optionsRequest++;
  }
  protected switchTab(kind: string) {
    if (this.tab() === kind) return;
    this.tab.set(kind);
    this.reset();
  }
  protected reset() {
    this.form.reset({
      kind: this.tab(),
      q: '',
      animal_id: '',
      result: '',
      date_from: '',
      date_to: '',
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
          .get<{ animals: Animal[] }>(`${this.api}/reports/breeding/options`, {
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
          .get<Page>(`${this.api}/reports/breeding`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte reproductivo.'));
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
          .get(`${this.api}/reports/breeding/export`, {
            params: this.params(),
            responseType: 'blob',
          })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-reproduccion-${kind}-${asOf}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
}
