import { HealthTrend } from './health-trend';
import { FeedingTrend } from './feeding-trend';
import { BreedingTrend } from './breeding-trend';
import { HealthDistribution } from './health-distribution';
import { HerdDistribution } from './herd-distribution';
import { FinanceTrend } from './finance-trend';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, ArrowUpRight } from 'lucide-angular';
import { navigationFor } from '../../../../../shared/ui/sidebar/navigation';
import { Session } from '../../../../../core/auth/session';
import { API_URL } from '../../../../../core/http/api-url';
import { apiError } from '../../../../../core/http/api-error';

export interface RanchSummary {
  as_of: string;
  period_from: string;
  period_to: string;
  herd: {
    total: number;
    active: number;
    exited: number;
    female: number;
    male: number;
  } | null;
  health: {
    open_cases: number;
    treatment_cases: number;
    closed_cases: number;
    total_cases: number;
    attention_count: number;
    pending: {
      program_id: string;
      program_name: string;
      animal: { id: string; name: string | null; siniiga: string | null };
      due_date: string | null;
      status: string;
    }[];
  } | null;
  breeding: { pregnant: number; births: number } | null;
  finance: {
    income_total: string | number;
    expense_total: string | number;
    balance: string | number;
  } | null;
  feeding: {
    consumptions: number;
    cost: string;
    unpriced_count: number;
  } | null;
  activity: {
    id: string;
    type_id: number;
    date: string;
    animal_name: string | null;
    siniiga: string | null;
  }[];
}
@Component({
  selector: 'app-overview',
  imports: [
    BreedingTrend,
    FeedingTrend,
    HealthTrend,
    HealthDistribution,
    HerdDistribution,
    FinanceTrend,
    RouterLink,
    LucideAngularModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './overview.html',
})
export class Overview implements OnDestroy {
  private readonly session = inject(Session);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private destroyed = false;
  protected readonly data = signal<RanchSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly chartRevision = signal(0);
  protected readonly error = signal('');
  protected readonly sections = computed(() =>
    navigationFor(this.session.user()?.permissions ?? []).filter(
      (item) => item.path !== 'overview',
    ),
  );
  protected readonly arrowIcon = ArrowUpRight;
  protected readonly eventLabels: Record<number, string> = {
    1: 'Observación',
    2: 'Diagnóstico',
    3: 'Tratamiento',
    4: 'Pesaje',
    9: 'Traslado',
    5: 'Monta',
    6: 'Diagnóstico de gestación',
    7: 'Parto',
    8: 'Salida',
  };
  protected readonly eventPaths: Record<number, string> = {
    1: 'health',
    2: 'health',
    3: 'health',
    4: 'management',
    5: 'breeding',
    6: 'breeding',
    7: 'breeding',
    8: 'exits',
  };
  protected readonly statusLabels: Record<string, string> = {
    overdue: 'Vencido',
    due: 'Corresponde hoy',
    upcoming: 'Próximo',
    missing_birth_date: 'Falta fecha de nacimiento',
  };
  constructor() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
  }
  protected async load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(
        this.http.get<RanchSummary>(`${this.api}/dashboard/summary`).pipe(timeout(15000)),
      );
      if (!this.destroyed) {
        this.data.set(data);
        this.chartRevision.update((value) => value + 1);
      }
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo cargar el resumen del rancho.'));
    } finally {
      if (!this.destroyed) this.loading.set(false);
    }
  }
}
