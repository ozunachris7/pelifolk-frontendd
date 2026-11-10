import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartModel, InteractiveChart } from '../../../../../shared/ui/chart/chart';

export interface HealthCounts {
  open_cases: number;
  treatment_cases: number;
  closed_cases: number;
  total_cases: number;
}
@Component({
  selector: 'app-health-distribution',
  imports: [InteractiveChart, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './health-distribution.html',
})
export class HealthDistribution {
  readonly health = input.required<HealthCounts>();
  readonly asOf = input.required<string>();
  private readonly chosenIndex = signal<number | null>(null);
  protected readonly rows = computed(() => [
    {
      label: 'Abiertos',
      count: this.health().open_cases,
      marker: 'bg-amber-700 dark:bg-amber-500',
    },
    {
      label: 'En tratamiento',
      count: this.health().treatment_cases,
      marker: 'bg-sky-600 dark:bg-sky-400',
    },
    {
      label: 'Cerrados',
      count: this.health().closed_cases,
      marker: 'bg-teal-700 dark:bg-teal-400',
    },
  ]);
  protected readonly selectedIndex = computed(
    () =>
      this.chosenIndex() ??
      Math.max(
        0,
        this.rows().findIndex((row) => row.count > 0),
      ),
  );
  protected readonly selected = computed(() => this.rows()[this.selectedIndex()]);
  protected readonly model = computed<ChartModel>(() => ({
    type: 'bar',
    unit: 'cases',
    tones: ['amber', 'blue', 'teal'],
    labels: this.rows().map((row) => row.label),
    series: [{ label: 'Cantidad', values: this.rows().map((row) => row.count) }],
  }));
  protected select(index: number) {
    if (index >= 0 && index < this.rows().length) this.chosenIndex.set(index);
  }
}
