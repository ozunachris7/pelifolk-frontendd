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
  kind: string;
  q: string;
  status: string;
  animal_id: string;
  program_id: string;
  date_from: string;
  date_to: string;
}
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface HealthRow {
  id: string;
  animal: Animal;
  status: string;
  reason?: string;
  notes?: string | null;
  start_date?: string;
  closed_date?: string | null;
  program_name?: string;
  product_name?: string;
  last_application?: string | null;
  due_date?: string | null;
  days_remaining?: number | null;
}
interface Page {
  as_of: string;
  kind: string;
  items: HealthRow[];
  total: number;
  counts: Record<string, number>;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-health-report',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './health-report.html',
})
export class HealthReport implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionsRequest = 0;
  private applied: Filters = {
    kind: 'cases',
    q: '',
    status: 'all',
    animal_id: '',
    program_id: '',
    date_from: '',
    date_to: '',
  };
  protected readonly allowed = !!this.session.user()?.permissions.includes('health:read');
  protected readonly tab = signal('cases');
  protected readonly download = Download;
  protected readonly form = this.fb.nonNullable.group(this.applied);
  protected readonly animalSearch = this.fb.nonNullable.control('');
  protected readonly page = signal<Page>({
    as_of: '',
    kind: 'cases',
    items: [],
    total: 0,
    counts: {},
    offset: 0,
    limit: 25,
  });
  protected readonly options = signal<{
    animals: Animal[];
    programs: { id: string; name: string }[];
  }>({ animals: [], programs: [] });
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly optionsLoading = signal(false);
  protected readonly error = signal('');
  protected readonly exportError = signal('');
  protected readonly optionError = signal('');
  protected readonly labels: Record<string, string> = {
    all: 'Todos',
    open: 'Abierto',
    under_treatment: 'En tratamiento',
    closed: 'Cerrado',
    attention: 'Requieren atención',
    overdue: 'Vencido',
    due: 'Corresponde hoy',
    upcoming: 'Próximo',
    scheduled: 'Programado',
    missing_birth_date: 'Falta fecha de nacimiento',
  };
  protected readonly caseStates = ['open', 'under_treatment', 'closed'];
  protected readonly noticeStates = [
    'overdue',
    'due',
    'upcoming',
    'scheduled',
    'missing_birth_date',
  ];
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
      status: this.tab() === 'cases' ? 'all' : 'attention',
      animal_id: '',
      program_id: '',
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
          .get<{ animals: Animal[]; programs: { id: string; name: string }[] }>(
            `${this.api}/reports/health/options`,
            { params: { animal_q: this.animalSearch.value.trim() } },
          )
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.optionsRequest) {
        const selected = this.options().animals.find(
          (a) => a.id === this.form.controls.animal_id.value,
        );
        if (selected && !o.animals.some((a) => a.id === selected.id)) o.animals.unshift(selected);
        this.options.set(o);
        this.optionError.set('');
      }
    } catch (e) {
      if (!this.destroyed && request === this.optionsRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar animales y programas.'));
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
          .get<Page>(`${this.api}/reports/health`, {
            params: { ...this.params(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el reporte sanitario.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async export() {
    if (this.exporting() || this.loading() || !this.allowed || this.error()) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const kind = this.applied.kind;
      const blob = await firstValueFrom(
        this.http
          .get(`${this.api}/reports/health/export`, { params: this.params(), responseType: 'blob' })
          .pipe(timeout(60000)),
      );
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `pelifolk-sanidad-${kind}-${this.page().as_of}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!this.destroyed) this.exportError.set(apiError(e, 'No se pudo descargar el Excel.'));
    } finally {
      if (!this.destroyed) this.exporting.set(false);
    }
  }
}
