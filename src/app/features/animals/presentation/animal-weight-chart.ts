import { InteractiveChart } from '../../../shared/ui/chart/chart';
import { weightChartModel } from '../../weights/presentation/weight-chart-model';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { hasPermission } from '../../users/domain/access';
import { measurements, WeightHistory } from '../../weights/domain/weights';

@Component({
  selector: 'app-animal-weight-chart',
  imports: [InteractiveChart, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './animal-weight-chart.html',
})
export class AnimalWeightChart {
  readonly animalId = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'weights:read'));
  protected readonly history = signal<WeightHistory | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly filterError = signal('');
  protected readonly applied = signal({ from: '', to: '' });
  protected readonly retry = signal(0);
  protected readonly increment = (value: number) => value + 1;
  protected readonly selectedId = signal('');
  protected readonly rows = computed(() => {
    const range = this.applied();
    // Compare with the previous effective measurement before filtering the visible dates.
    return measurements(this.history()?.items ?? []).filter(
      (row) => (!range.from || row.date >= range.from) && (!range.to || row.date <= range.to),
    );
  });
  protected readonly graph = computed(() => weightChartModel(this.rows()));
  protected readonly selectedIndex = computed(() =>
    this.rows().findIndex((row) => row.id === this.selected()?.id),
  );
  protected selectWeight(index: number) {
    const weight = this.rows()[index];
    if (weight) this.selectedId.set(weight.id);
  }
  protected readonly selected = computed(
    () => this.rows().find((row) => row.id === this.selectedId()) ?? this.rows().at(-1) ?? null,
  );
  private lastAnimal = '';
  constructor() {
    effect((onCleanup) => {
      const id = this.animalId(),
        allowed = this.canRead();
      this.retry();
      if (id !== this.lastAnimal) {
        this.lastAnimal = id;
        this.from.set('');
        this.to.set('');
        this.applied.set({ from: '', to: '' });
        this.filterError.set('');
      }
      this.history.set(null);
      this.error.set('');
      this.selectedId.set('');
      this.loading.set(allowed);
      if (!allowed) return;
      const subscription = this.http
        .get<WeightHistory>(`${this.api}/weights/animals/${id}/history`)
        .pipe(timeout(15000))
        .subscribe({
          next: (history) => {
            this.history.set(history);
            this.loading.set(false);
          },
          error: (error) => {
            this.error.set(apiError(error, 'No se pudo cargar la evolución del peso.'));
            this.loading.set(false);
          },
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }
  protected apply() {
    const from = this.from(),
      to = this.to();
    if (
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
      (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) ||
      (from && to && from > to)
    ) {
      this.filterError.set(
        'Selecciona las fechas en orden: Desde debe ser anterior o igual a Hasta.',
      );
      return;
    }
    this.filterError.set('');
    this.applied.set({ from, to });
    this.selectedId.set('');
  }
  protected clear() {
    this.from.set('');
    this.to.set('');
    this.apply();
  }
}
