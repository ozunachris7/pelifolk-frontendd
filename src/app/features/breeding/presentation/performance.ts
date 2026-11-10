import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { LucideAngularModule, Baby, ChartNoAxesCombined, ClipboardList } from 'lucide-angular';
import { OffspringHealth } from './offspring-health';
import { ChildHealthCounts, ParentHealthCounts } from '../domain/offspring-health';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Animal, animalLabel } from '../domain/breeding';
import { exitLabel } from '../../exits/domain/exits';
interface Metric {
  health?: ParentHealthCounts;
  animal: Animal;
  is_breeder: boolean;
  status: string;
  matings: number;
  births: number;
  offspring: number;
  live_births: number;
  stillbirths: number;
  unknown_birth_condition: number;
  post_birth_deaths: number;
  in_herd: number;
  other_exits: number;
  weighed_offspring: number;
  average_birth_weight_kg: string | null;
  weaned_offspring: number;
  average_weaning_weight_kg: string | null;
  offspring_per_recorded_birth: string | null;
}
interface Page {
  health_summary?: ParentHealthCounts;
  as_of: string;
  sex: string;
  date_from: string | null;
  date_to: string | null;
  items: Metric[];
  total: number;
  summary: Record<string, number>;
  offset: number;
  limit: number;
}
interface Child {
  health?: ChildHealthCounts;
  animal: Animal;
  birth_date: string | null;
  born_alive: boolean | null;
  birth_weight_kg: string | null;
  birth_event_id: string | null;
  status: string;
  exit_date: string | null;
  weaning: { date: string; weight_kg: string; age_days: number | null } | null;
}
interface Children {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  parent: Metric;
  items: Child[];
  total: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-performance',
  imports: [
    DetailPage,
    LucideAngularModule,
    OffspringHealth,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './performance.html',
})
export class Performance implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private childRequest = 0;
  private applied = { sex: 'female', q: '', status: 'all', date_from: '', date_to: '' };
  private childFilters = { date_from: '', date_to: '' };
  protected readonly allowed = !!this.session.user()?.permissions.includes('breeding:read');
  protected readonly canHealth =
    this.allowed && !!this.session.user()?.permissions.includes('health:read');
  protected readonly canGenealogy = !!this.session.user()?.permissions.includes('animals:read');
  protected readonly form = this.fb.nonNullable.group({
    q: '',
    status: 'all',
    date_from: '',
    date_to: '',
  });
  protected readonly sex = signal('female');
  protected readonly page = signal<Page>({
    as_of: '',
    sex: 'female',
    date_from: null,
    date_to: null,
    items: [],
    total: 0,
    summary: {},
    offset: 0,
    limit: 25,
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<Metric | null>(null);
  protected readonly children = signal<Children | null>(null);
  protected readonly childLoading = signal(false);
  protected readonly childError = signal('');
  protected readonly label = animalLabel;
  protected readonly babyIcon = Baby;
  protected readonly indicatorsIcon = ChartNoAxesCombined;
  protected readonly evaluationsIcon = ClipboardList;
  protected readonly statusLabel = exitLabel;
  constructor() {
    if (this.allowed) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.childRequest++;
  }
  protected switchSex(sex: string) {
    if (this.sex() === sex) return;
    this.sex.set(sex);
    this.search();
  }
  protected search() {
    const f = this.form.getRawValue();
    if (f.date_from && f.date_to && f.date_from > f.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = { ...f, q: f.q.trim(), sex: this.sex() };
    void this.load();
  }
  protected reset() {
    this.form.reset({ q: '', status: 'all', date_from: '', date_to: '' });
    this.search();
  }
  protected async load(offset = 0) {
    if (!this.allowed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const params = Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/breeding/performance`, {
            params: { ...params, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar el desempeño de reproductores.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected showChildren(m: Metric) {
    this.selected.set(m);
    this.childFilters = { date_from: this.applied.date_from, date_to: this.applied.date_to };
    void this.loadChildren();
  }
  protected closeChildren() {
    this.childRequest++;
    this.selected.set(null);
    this.children.set(null);
    this.childLoading.set(false);
  }
  protected async loadChildren(offset = 0) {
    const parent = this.selected();
    if (!parent) return;
    const request = ++this.childRequest;
    this.childLoading.set(true);
    this.childError.set('');
    this.children.set(null);
    const params = Object.fromEntries(
      Object.entries(this.childFilters).filter(([, v]) => v !== ''),
    );
    try {
      const p = await firstValueFrom(
        this.http
          .get<Children>(`${this.api}/breeding/performance/${parent.animal.id}/offspring`, {
            params: { ...params, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.childRequest) this.children.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.childRequest)
        this.childError.set(apiError(e, 'No se pudieron cargar las crías.'));
    } finally {
      if (!this.destroyed && request === this.childRequest) this.childLoading.set(false);
    }
  }
}
