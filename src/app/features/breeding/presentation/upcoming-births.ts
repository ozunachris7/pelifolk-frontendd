import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, History as HistoryIcon } from 'lucide-angular';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { BreedingRepository } from '../infrastructure/breeding-repository';
import { Animal, History, animalLabel, kindLabel, resultLabel } from '../domain/breeding';
interface Upcoming {
  id: string;
  animal: Animal;
  diagnosis_date: string;
  mating_event_id: string | null;
  mating_date: string | null;
  male: Animal | null;
  expected_birth_date: string | null;
  days_remaining: number | null;
  status: string;
  missing_reason: string | null;
}
interface Page {
  as_of: string;
  gestation_days: number;
  notice_days: number;
  items: Upcoming[];
  total: number;
  counts: Record<string, number>;
  offset: number;
  limit: number;
}
@Component({
  selector: 'app-upcoming-births',
  imports: [DetailPage, DatePipe, ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './upcoming-births.html',
})
export class UpcomingBirths implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly repo = inject(BreedingRepository);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private historyRequest = 0;
  private applied = { q: '', status: 'all', notice_days: 14 };
  protected readonly allowed = !!this.session.user()?.permissions.includes('breeding:read');
  protected readonly canWrite = !!this.session.user()?.permissions.includes('breeding:write');
  protected readonly form = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    status: ['all'],
    notice_days: [
      14,
      [Validators.required, Validators.min(1), Validators.max(60), Validators.pattern(/^\d+$/)],
    ],
  });
  protected readonly page = signal<Page>({
    as_of: '',
    gestation_days: 147,
    notice_days: 14,
    items: [],
    total: 0,
    counts: {},
    offset: 0,
    limit: 25,
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly history = signal<History | null>(null);
  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly label = animalLabel;
  protected readonly kindLabel = kindLabel;
  protected readonly resultLabel = resultLabel;
  protected readonly clock = HistoryIcon;
  protected readonly states: Record<string, string> = {
    past_estimate: 'Fecha estimada pasada',
    due: 'Estimado para hoy',
    upcoming: 'Próximo',
    scheduled: 'Más adelante',
    missing_mating: 'Sin fecha estimada',
  };
  protected readonly reasons: Record<string, string> = {
    unlinked: 'Diagnóstico sin monta vinculada.',
    unavailable_mating: 'La monta vinculada no está vigente.',
    invalid_mating: 'La monta vinculada no permite estimar esta gestación.',
    before_last_birth: 'La monta vinculada corresponde a un ciclo anterior al último parto.',
  };
  constructor() {
    if (this.allowed) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.historyRequest++;
  }
  protected search() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    this.applied = { ...f, q: f.q.trim() };
    void this.load();
  }
  protected reset() {
    this.form.reset({ q: '', status: 'all', notice_days: 14 });
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
          .get<Page>(`${this.api}/breeding/upcoming-births`, {
            params: { ...this.applied, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) this.page.set(p);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudieron cargar los partos próximos.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected remaining(r: Upcoming) {
    if (r.days_remaining === null) return 'Sin referencia de monta';
    if (r.days_remaining < 0) {
      const days = -r.days_remaining;
      return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
    if (r.days_remaining === 0) return 'Hoy';
    return `En ${r.days_remaining} ${r.days_remaining === 1 ? 'día' : 'días'}`;
  }
  protected closeHistory() {
    this.historyRequest++;
    this.historyOpen.set(false);
    this.history.set(null);
    this.historyLoading.set(false);
  }
  protected async showHistory(a: Animal) {
    const request = ++this.historyRequest;
    this.history.set(null);
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const h = await this.repo.history(a.id);
      if (!this.destroyed && request === this.historyRequest) this.history.set(h);
    } catch (e) {
      if (!this.destroyed && request === this.historyRequest)
        this.historyError.set(apiError(e, 'No se pudo cargar el historial reproductivo.'));
    } finally {
      if (!this.destroyed && request === this.historyRequest) this.historyLoading.set(false);
    }
  }
}
