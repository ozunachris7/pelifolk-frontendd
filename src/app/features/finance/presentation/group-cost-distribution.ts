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
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Modal } from '../../../shared/ui/modal/modal';
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface AnimalRow {
  animal: Animal;
  expenses: string;
  expense_records: number;
  feeding?: string;
  feeding_records?: number;
  unpriced_feeding?: number;
}
interface Source {
  id: string;
  kind: 'expense' | 'feeding';
  date: string;
  group_id: string;
  group_name: string;
  title: string;
  amount: string | null;
  original_amount?: string;
  percentage?: string;
  member_count: number;
  animal_amount?: string | null;
  status: string;
}
interface Page {
  kind: string;
  view: string;
  feeding_included: boolean;
  as_of: string;
  items: unknown[];
  total: number;
  offset: number;
  limit: number;
  summary: {
    source_count: number;
    attributed_expenses: string;
    attributed_feeding?: string;
    source_expenses: string;
    unallocated_expenses: string;
    unallocated_feeding?: string;
    unpriced_feeding?: number;
    records_without_members: number;
  };
}
interface Detail {
  source: Source;
  items: { animal: Animal; amount: string | null }[];
  total: number;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-group-cost-distribution',
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, Modal],
  templateUrl: './group-cost-distribution.html',
})
export class GroupCostDistribution implements OnDestroy {
  readonly kind = input.required<string>();
  readonly targetId = input.required<string>();
  readonly dateFrom = input('');
  readonly dateTo = input('');
  readonly revision = input(0);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('finance:read'),
  );
  protected readonly eye = Eye;
  protected readonly open = signal(false);
  protected readonly view = signal<'animals' | 'sources'>('animals');
  protected readonly page = signal<Page | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly animalRows = computed(
    () => (this.page()?.view === 'animals' ? this.page()?.items || [] : []) as AnimalRow[],
  );
  protected readonly sourceRows = computed(
    () => (this.page()?.view === 'sources' ? this.page()?.items || [] : []) as Source[],
  );
  protected readonly label = (a: Animal) =>
    [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  protected readonly selected = signal<Source | null>(null);
  protected readonly detail = signal<Detail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  private request = 0;
  private detailRequest = 0;
  private destroyed = false;
  constructor() {
    effect(() => {
      this.revision();
      this.kind();
      this.targetId();
      this.dateFrom();
      this.dateTo();
      this.view();
      if (this.open() && this.allowed())
        untracked(() => {
          this.closeDetail();
          void this.load();
        });
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.detailRequest++;
  }
  protected toggle() {
    this.open.update((v) => !v);
    if (!this.open()) {
      this.request++;
      this.closeDetail();
    }
  }
  protected async load(offset = 0) {
    if (!this.allowed()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/finance/group-costs`, {
            params: {
              kind: this.kind(),
              target_id: this.targetId(),
              view: this.view(),
              offset,
              limit: 25,
              ...(this.dateFrom() ? { date_from: this.dateFrom() } : {}),
              ...(this.dateTo() ? { date_to: this.dateTo() } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudo calcular el reparto de los lotes.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  protected inspect(source: Source) {
    this.selected.set(source);
    this.detail.set(null);
    void this.loadDetail();
  }
  protected closeDetail() {
    this.detailRequest++;
    this.selected.set(null);
    this.detail.set(null);
  }
  protected async loadDetail(offset = 0) {
    const source = this.selected();
    if (!source) return;
    const n = ++this.detailRequest;
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Detail>(`${this.api}/finance/group-costs/sources/${source.kind}/${source.id}`, {
            params: { offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.detailRequest && !this.destroyed) this.detail.set(p);
    } catch (e) {
      if (n === this.detailRequest && !this.destroyed)
        this.detailError.set(apiError(e, 'No se pudo consultar el origen del reparto.'));
    } finally {
      if (n === this.detailRequest && !this.destroyed) this.detailLoading.set(false);
    }
  }
}
