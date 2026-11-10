import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  ChartDataset,
  ScriptableContext,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
);
type Kind = 'bar' | 'line';
type Value = number | null | { x: number; y: number | null };
export const CHART_FACTORY = new InjectionToken<
  (
    canvas: HTMLCanvasElement,
    configuration: ChartConfiguration<Kind, Value[], string>,
  ) => Chart<Kind, Value[], string>
>('Chart.js factory', {
  providedIn: 'root',
  factory: () => (canvas, configuration) => new Chart<Kind, Value[], string>(canvas, configuration),
});
export type ChartTone = 'green' | 'amber' | 'blue' | 'violet' | 'teal';
export interface ChartModel {
  type: Kind;
  labels: string[];
  series: { label: string; values: (number | null)[]; tone?: ChartTone }[];
  tones?: ChartTone[];
  connectGaps?: boolean;
  unit: 'MXN' | 'kg' | 'animals' | 'cases' | 'records' | 'quantity';
  unitLabel?: string;
  days?: number[];
  titles?: string[];
  annotations?: string[];
}

@Component({
  selector: 'app-chart',
  template: `
    <div class="relative h-72 min-w-0 w-full sm:h-80">
      <canvas
        #canvas
        tabindex="0"
        role="img"
        [attr.aria-label]="
          label() +
          '. Usa las flechas izquierda y derecha para seleccionar registros; Inicio y Fin para ir a los extremos.'
        "
        (keydown)="navigate($event)"
        (blur)="hideTooltip()"
        class="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-green-700 dark:focus-visible:ring-green-400"
      >
        Consulta los valores exactos en la tabla que acompaña la gráfica.
      </canvas>
    </div>
    @if (unavailable()) {
      <p class="mt-3 text-xs text-stone-500">
        La vista gráfica no está disponible en este navegador. Consulta los valores en la tabla.
      </p>
    }
  `,
})
export class InteractiveChart {
  readonly model = input.required<ChartModel>();
  readonly label = input.required<string>();
  readonly selectedIndex = input(-1);
  readonly selectIndex = output<number>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly document = inject(DOCUMENT);
  private readonly createChart = inject(CHART_FACTORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dark = signal(this.document.documentElement.classList.contains('dark'));
  private readonly reduceMotion = signal(false);
  protected readonly unavailable = signal(false);
  private chart: Chart<Kind, Value[], string> | null = null;
  private focusedIndex = -1;
  private previous: { model: ChartModel; dark: boolean; reduced: boolean } | null = null;
  constructor() {
    afterNextRender(() => {
      const observer = new MutationObserver(() =>
        this.dark.set(this.document.documentElement.classList.contains('dark')),
      );
      observer.observe(this.document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
      const media = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
      const motion = () => this.reduceMotion.set(media?.matches ?? false);
      motion();
      media?.addEventListener('change', motion);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        media?.removeEventListener('change', motion);
      });
    });
    afterRenderEffect(() =>
      this.draw(this.model(), this.dark(), this.reduceMotion(), this.selectedIndex()),
    );
    this.destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }
  private draw(model: ChartModel, dark: boolean, reduced: boolean, selected: number) {
    // A browser without 2D canvas can still use the accessible tables beside each chart.
    if (typeof CanvasRenderingContext2D === 'undefined') {
      this.unavailable.set(true);
      return;
    }
    if (
      this.previous?.model === model &&
      this.previous.dark === dark &&
      this.previous.reduced === reduced &&
      this.chart
    ) {
      if (model.type === 'line') {
        for (const dataset of this.chart.data.datasets) {
          (dataset as ChartDataset<'line', Value[]>).pointRadius = model.labels.map((_, index) =>
            index === selected ? 6 : 4,
          );
        }
        this.chart.update('none');
      }
      return;
    }
    if (this.previous?.model !== model) this.focusedIndex = -1;
    const canvas = this.canvas().nativeElement;
    if (!canvas.getContext('2d')) {
      this.unavailable.set(true);
      return;
    }
    this.unavailable.set(false);
    const configuration = this.configuration(model, dark, reduced, selected);
    if (this.chart && this.previous?.model.type === model.type) {
      this.chart.data = configuration.data;
      this.chart.options = configuration.options ?? {};
      this.chart.update(reduced ? 'none' : undefined);
    } else {
      this.chart?.destroy();
      this.chart = this.createChart(canvas, configuration);
    }
    this.previous = { model, dark, reduced };
  }
  private configuration(
    model: ChartModel,
    dark: boolean,
    reduced: boolean,
    selected: number,
  ): ChartConfiguration<Kind, Value[], string> {
    const palette: Record<ChartTone, { fill: string; hover: string }> = {
      green: { fill: dark ? '#22c55e' : '#166534', hover: dark ? '#4ade80' : '#15803d' },
      amber: { fill: dark ? '#f59e0b' : '#b45309', hover: dark ? '#fbbf24' : '#92400e' },
      blue: { fill: dark ? '#38bdf8' : '#0284c7', hover: dark ? '#7dd3fc' : '#0369a1' },
      violet: { fill: dark ? '#a78bfa' : '#7c3aed', hover: dark ? '#c4b5fd' : '#6d28d9' },
      teal: { fill: dark ? '#2dd4bf' : '#0f766e', hover: dark ? '#5eead4' : '#115e59' },
    };
    const alpha = (hex: string, opacity: number) =>
      `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${opacity})`;
    const text = dark ? '#a8a29e' : '#78716c';
    const grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(120,113,108,.13)';
    const line = model.type === 'line';
    const count = model.unit === 'animals' || model.unit === 'cases' || model.unit === 'records';
    const datasets: ChartDataset<Kind, Value[]>[] = model.series.map((series, index) => {
      const color = palette[series.tone ?? (line ? 'teal' : index ? 'amber' : 'green')];
      const colors = model.tones?.map((tone) => palette[tone]);
      return {
        label: series.label,
        data: line ? series.values.map((y, i) => ({ x: model.days![i], y })) : [...series.values],
        borderColor: !line && colors ? colors.map((color) => color.fill) : color.fill,
        backgroundColor: !line && colors ? colors.map((color) => color.fill) : color.fill,
        hoverBackgroundColor: !line && colors ? colors.map((color) => color.hover) : color.hover,
        borderWidth: line ? 2.5 : 0,
        borderRadius: line ? 0 : 5,
        maxBarThickness: count ? 64 : 38,
        pointRadius: model.labels.map((_, i) => (i === selected ? 6 : 4)),
        pointHoverRadius: 8,
        pointHitRadius: 18,
        pointBackgroundColor: color.fill,
        pointHoverBackgroundColor: color.hover,
        tension: 0,
        fill: line && model.series.length === 1,
        spanGaps: model.connectGaps ?? false,
        ...(line && model.series.length === 1
          ? {
              backgroundColor: (context: ScriptableContext<'line'>) => {
                const { ctx, chartArea } = context.chart;
                if (!chartArea) return alpha(color.fill, 0.08);
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, alpha(color.fill, dark ? 0.22 : 0.16));
                gradient.addColorStop(1, alpha(color.fill, 0));
                return gradient;
              },
            }
          : {}),
      };
    });
    const values = model.series
      .flatMap((series) => series.values)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const min = Math.min(...(values.length ? values : [0])),
      max = Math.max(...(values.length ? values : [0]));
    const padding = Math.max(2, (max - min) * 0.15);
    const format = (value: number) =>
      model.unit === 'MXN'
        ? new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
          }).format(value)
        : count
          ? `${new Intl.NumberFormat('es-MX').format(value)} ${model.unit === 'records' ? (value === 1 ? 'registro' : 'registros') : model.unit === 'cases' ? (value === 1 ? 'caso' : 'casos') : value === 1 ? 'animal' : 'animales'}`
          : `${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${model.unitLabel ?? 'kg'}`;
    const date = (day: number) =>
      new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(day * 86400000));
    return {
      type: model.type,
      data: { labels: [...model.labels], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: 'es-MX',
        animation: reduced ? false : { duration: 750, easing: 'easeOutQuart' },
        transitions: { active: { animation: { duration: reduced ? 0 : 180 } } },
        interaction: { mode: 'index', axis: 'x', intersect: false },
        onHover: (_event, elements) => {
          this.canvas().nativeElement.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (_event, elements) => {
          if (elements.length) {
            this.focusedIndex = elements[0].index;
            this.selectIndex.emit(elements[0].index);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            displayColors: !line,
            padding: 12,
            cornerRadius: 10,
            backgroundColor: dark ? '#20231f' : '#1c1917',
            titleColor: '#fafaf9',
            bodyColor: '#e7e5e4',
            borderColor: 'rgba(255,255,255,.14)',
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                const i = items[0]?.dataIndex ?? 0;
                return model.titles?.[i] ?? model.labels[i];
              },
              label: (context) => `${context.dataset.label}: ${format(Number(context.parsed.y))}`,
              afterBody: (items) => {
                const i = items[0]?.dataIndex ?? 0;
                if (model.unit === 'MXN' && model.series.length === 2)
                  return [
                    `Balance: ${format((model.series[0].values[i] ?? 0) - (model.series[1].values[i] ?? 0))}`,
                  ];
                if (model.unit === 'animals' || model.unit === 'cases') {
                  const total = model.series[0].values.reduce<number>(
                    (sum, value) => sum + (value ?? 0),
                    0,
                  );
                  if (total > 0)
                    return [
                      `${new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 }).format((model.series[0].values[i] ?? 0) / total)} del total de esta gráfica`,
                    ];
                }
                return model.annotations?.[i] ? [model.annotations[i]] : [];
              },
            },
          },
        },
        scales: {
          x: {
            type: line ? 'linear' : 'category',
            ...(line && model.days?.length
              ? {
                  min: Math.min(...model.days) - (model.days.length === 1 ? 1 : 0),
                  max: Math.max(...model.days) + (model.days.length === 1 ? 1 : 0),
                }
              : {}),
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: text,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: line ? 4 : 6,
              ...(line ? { callback: (value) => date(Number(value)) } : {}),
            },
          },
          y: {
            beginAtZero: !line,
            ...(line ? { min: Math.max(0, min - padding), max: max + padding } : {}),
            border: { display: false },
            grid: { color: grid, drawTicks: false },
            title: {
              display: true,
              text:
                model.unit === 'records'
                  ? 'Registros'
                  : model.unit === 'cases'
                    ? 'Casos'
                    : model.unit === 'animals'
                      ? 'Animales'
                      : (model.unitLabel ?? model.unit),
              color: text,
              align: 'end',
            },
            ticks: {
              color: text,
              maxTicksLimit: 5,
              ...(count ? { precision: 0 } : {}),
              padding: 10,
              callback: (value) =>
                new Intl.NumberFormat('es-MX', {
                  notation: model.unit === 'MXN' ? 'compact' : 'standard',
                  maximumFractionDigits: count ? 0 : 1,
                }).format(Number(value)),
            },
          },
        },
      },
    };
  }
  protected hideTooltip() {
    this.chart?.setActiveElements([]);
    this.chart?.tooltip?.setActiveElements([], { x: 0, y: 0 });
    this.chart?.update('none');
  }
  protected navigate(event: KeyboardEvent) {
    const size = this.model().labels.length;
    if (!size || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = this.selectedIndex() >= 0 ? this.selectedIndex() : this.focusedIndex;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? size - 1
          : Math.max(0, Math.min(size - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)));
    this.focusedIndex = index;
    this.selectIndex.emit(index);
    const chart = this.chart;
    if (!chart) return;
    const active = this.model().series.flatMap((series, datasetIndex) =>
      Number.isFinite(series.values[index]) ? [{ datasetIndex, index }] : [],
    );
    chart.setActiveElements(active);
    const point = active.length ? chart.getDatasetMeta(active[0].datasetIndex).data[index] : null;
    if (point) chart.tooltip?.setActiveElements(active, { x: point.x, y: point.y });
    chart.update('none');
  }
}
