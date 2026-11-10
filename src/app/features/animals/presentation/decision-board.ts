import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Eye, ExternalLink, LucideAngularModule } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
interface Decision {
  id: string;
  date: string;
  kind: string;
  reason: string;
  recorded_by: string;
}
interface Entry {
  animal: {
    id: string;
    name: string | null;
    siniiga: string | null;
    sex: string;
    is_breeder: boolean;
  };
  status: string;
  exit_date: string | null;
  decision: Decision;
  health?: {
    total_cases: number;
    open_cases: number;
    under_treatment_cases: number;
    closed_cases: number;
  };
  withdrawal?: { status: string; release_date: string | null };
  breeding?: {
    last_mating_date: string | null;
    last_birth_date: string | null;
    pregnancy: { result: string; date: string } | null;
  };
}
interface Page {
  items: Entry[];
  total: number;
  offset: number;
  limit: number;
  as_of: string;
  summary: Record<string, number>;
}
@Component({
  selector: 'app-decision-board',
  imports: [DatePipe, RouterLink, LucideAngularModule, Modal],
  templateUrl: './decision-board.html',
})
export class DecisionBoard implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly canRead = computed(
    () => !!this.session.user()?.permissions.includes('animals:read'),
  );
  protected readonly eye = Eye;
  protected readonly external = ExternalLink;
  protected readonly kinds = [
    ['retain_breeding', 'Conservar para reproducción'],
    ['exclude_breeding', 'Descartar para reproducción'],
    ['separate', 'Separar del hato'],
    ['sale_planned', 'Venta prevista'],
  ];
  protected readonly label = (kind: string) =>
    this.kinds.find((k) => k[0] === kind)?.[1] ||
    { purchase_reason: 'Motivo de compra', other: 'Otra decisión' }[kind] ||
    kind;
  protected readonly name = (e: Entry) => e.animal.name || e.animal.siniiga || 'Sin nombre';
  protected readonly withdrawalLabel = (status: string) =>
    ({
      no_records: 'Sin tratamientos registrados',
      unknown: 'Periodo por verificar',
      pending: 'En retiro',
      complete: 'Retiro calculado cumplido',
    })[status] || 'Por verificar';
  protected readonly pregnancyLabel = (result: string) =>
    ({ pregnant: 'Gestante', not_pregnant: 'Vacía', uncertain: 'Dudosa' })[result] || result;
  protected readonly search = signal('');
  protected readonly kind = signal('');
  protected readonly status = signal('active');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly page = signal<Page>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
    as_of: '',
    summary: {},
  });
  protected readonly detail = signal<Entry | null>(null);
  protected readonly history = signal<{ items: Decision[]; total: number; offset: number }>({
    items: [],
    total: 0,
    offset: 0,
  });
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  private request = 0;
  private historyRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.historyRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Page>(`${this.api}/management-decisions`, {
            params: {
              q: this.search(),
              status: this.status(),
              offset,
              limit: 25,
              ...(this.kind() ? { kind: this.kind() } : {}),
            },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && n === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && n === this.request) {
        this.page.set({ items: [], total: 0, offset: 0, limit: 25, as_of: '', summary: {} });
        this.error.set(apiError(e, 'No se pudieron consultar las decisiones.'));
      }
    } finally {
      if (!this.destroyed && n === this.request) this.loading.set(false);
    }
  }
  protected open(e: Entry) {
    this.detail.set(e);
    this.history.set({ items: [], total: 0, offset: 0 });
    void this.loadHistory();
  }
  protected close() {
    this.historyRequest++;
    this.detail.set(null);
  }
  protected async loadHistory(offset = 0) {
    const entry = this.detail();
    if (!entry) return;
    const n = ++this.historyRequest;
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<{ items: Decision[]; total: number; offset: number }>(
            `${this.api}/animals/${entry.animal.id}/decisions`,
            { params: { offset, limit: 10 } },
          )
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && n === this.historyRequest) this.history.set(p);
    } catch (e) {
      if (!this.destroyed && n === this.historyRequest)
        this.historyError.set(apiError(e, 'No se pudo consultar el historial.'));
    } finally {
      if (!this.destroyed && n === this.historyRequest) this.historyLoading.set(false);
    }
  }
}
