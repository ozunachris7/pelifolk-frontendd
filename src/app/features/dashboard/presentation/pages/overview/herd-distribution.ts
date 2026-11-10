import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartModel, ChartTone, InteractiveChart } from '../../../../../shared/ui/chart/chart';

export interface HerdCounts {
  total: number;
  active: number;
  exited: number;
  female: number;
  male: number;
}
@Component({
  selector: 'app-herd-distribution',
  imports: [InteractiveChart, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './herd-distribution.html',
})
export class HerdDistribution {
  readonly herd = input.required<HerdCounts>();
  readonly asOf = input.required<string>();
  protected readonly sexIndex = signal(0);
  protected readonly stateIndex = signal(0);
  protected readonly sexRows = computed(() => [
    { label: 'Hembras', count: this.herd().female },
    { label: 'Machos', count: this.herd().male },
  ]);
  protected readonly stateRows = computed(() => [
    { label: 'Activos', count: this.herd().active },
    { label: 'Bajas', count: this.herd().exited },
  ]);
  protected readonly sexModel = computed(() => this.model(this.sexRows(), ['violet', 'blue']));
  protected readonly stateModel = computed(() => this.model(this.stateRows(), ['green', 'amber']));
  protected readonly selectedSex = computed(() => this.sexRows()[this.sexIndex()]);
  protected readonly selectedState = computed(() => this.stateRows()[this.stateIndex()]);
  private model(rows: { label: string; count: number }[], tones: ChartTone[]): ChartModel {
    return {
      type: 'bar',
      tones,
      unit: 'animals',
      labels: rows.map((row) => row.label),
      series: [{ label: 'Cantidad', values: rows.map((row) => row.count) }],
    };
  }
}
