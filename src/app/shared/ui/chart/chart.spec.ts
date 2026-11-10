import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CHART_FACTORY, ChartModel, InteractiveChart } from './chart';
const mocked = { instances: [] as any[] };
class FakeChart {
  data: any;
  options: any;
  update = vi.fn();
  destroy = vi.fn();
  setActiveElements = vi.fn();
  tooltip = { setActiveElements: vi.fn() };
  getDatasetMeta = () => ({
    data: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
  });
  constructor(_canvas: unknown, config: any) {
    this.data = config.data;
    this.options = config.options;
    mocked.instances.push(this);
  }
}
const bars: ChartModel = {
  type: 'bar',
  unit: 'MXN',
  labels: ['ene 26', 'feb 26'],
  series: [
    { label: 'Ingresos', values: [100, 250] },
    { label: 'Gastos', values: [30, 50] },
  ],
};
const line: ChartModel = {
  type: 'line',
  unit: 'kg',
  labels: ['01/01/2026', '11/01/2026'],
  days: [20454, 20464],
  series: [{ label: 'Peso', values: [20, 22] }],
  annotations: ['', 'Pesaje de destete'],
};
async function fixture(model = bars) {
  const f = TestBed.createComponent(InteractiveChart);
  f.componentRef.setInput('model', model);
  f.componentRef.setInput('label', 'Gráfica de prueba');
  f.componentRef.setInput('selectedIndex', 0);
  f.detectChanges();
  await f.whenStable();
  TestBed.tick();
  return f;
}
describe('Chart.js integration', () => {
  beforeEach(async () => {
    mocked.instances.length = 0;
    document.documentElement.classList.remove('dark');
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    await TestBed.configureTestingModule({
      imports: [InteractiveChart],
      providers: [
        {
          provide: CHART_FACTORY,
          useValue: (canvas: unknown, config: any) => new FakeChart(canvas, config),
        },
      ],
    }).compileComponents();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
  });
  it('uses a shared monetary scale and animated bars, with exact tooltip values and balance', async () => {
    const f = await fixture();
    const chart = mocked.instances[0];
    expect(chart.data.datasets.map((s: any) => s.data)).toEqual([
      [100, 250],
      [30, 50],
    ]);
    expect(chart.options.animation.duration).toBe(750);
    expect(chart.options.scales.y.beginAtZero).toBe(true);
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Ingresos' },
        parsed: { y: 100.1 },
      }),
    ).toContain('100.10');
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 1 }])[0]).toContain(
      '200.00',
    );
    f.destroy();
    expect(chart.destroy).toHaveBeenCalledOnce();
  });
  it('keeps actual day spacing, single points and weaning tooltip annotations', async () => {
    const f = await fixture(line);
    const chart = mocked.instances[0];
    expect(chart.data.datasets[0].data).toEqual([
      { x: 20454, y: 20 },
      { x: 20464, y: 22 },
    ]);
    expect(chart.options.scales.x.type).toBe('linear');
    expect(chart.data.datasets[0].tension).toBe(0);
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 1 }])).toEqual([
      'Pesaje de destete',
    ]);
    f.componentRef.setInput('model', {
      ...line,
      labels: [line.labels[0]],
      days: [line.days![0]],
      series: [{ label: 'Peso', values: [20] }],
    });
    f.detectChanges();
    await f.whenStable();
    expect(chart.options.scales.x.max - chart.options.scales.x.min).toBe(2);
    expect(chart.data.datasets[0].data).toHaveLength(1);
  });
  it('supports click and keyboard selection and opens the corresponding tooltip', async () => {
    const f = await fixture();
    const chart = mocked.instances[0],
      selected = vi.fn();
    f.componentInstance.selectIndex.subscribe(selected);
    chart.options.onClick(null, [{ index: 1 }]);
    expect(selected).toHaveBeenLastCalledWith(1);
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(selected).toHaveBeenLastCalledWith(1);
    expect(chart.tooltip.setActiveElements).toHaveBeenCalledWith(
      [
        { datasetIndex: 0, index: 1 },
        { datasetIndex: 1, index: 1 },
      ],
      { x: 30, y: 40 },
    );
    canvas.dispatchEvent(new FocusEvent('blur'));
    expect(chart.tooltip.setActiveElements).toHaveBeenLastCalledWith([], { x: 0, y: 0 });
  });
  it('respects reduced motion and updates the existing chart when the theme changes', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const f = await fixture();
    const chart = mocked.instances[0];
    expect(chart.options.animation).toBe(false);
    const originalColor = chart.data.datasets[0].backgroundColor;
    document.documentElement.classList.add('dark');
    await expect
      .poll(async () => {
        f.detectChanges();
        await f.whenStable();
        return chart.data.datasets[0].backgroundColor;
      })
      .not.toBe(originalColor);
    expect(mocked.instances).toHaveLength(1);
    expect(chart.update).toHaveBeenCalledWith('none');
  });
  it('advances keyboard selection when a read-only history has no bound selection', async () => {
    const f = await fixture();
    f.componentRef.setInput('selectedIndex', -1);
    f.detectChanges();
    TestBed.tick();
    const selected = vi.fn();
    f.componentInstance.selectIndex.subscribe(selected);
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(selected.mock.calls.map((call) => call[0])).toEqual([0, 1]);
  });
  it('formats animal counts as integers, with a zero baseline and percentage tooltips', async () => {
    const f = await fixture({
      type: 'bar',
      unit: 'animals',
      labels: ['Hembras', 'Machos'],
      series: [{ label: 'Cantidad', values: [3, 1] }],
    });
    const chart = mocked.instances[0];
    expect(chart.options.scales.y.beginAtZero).toBe(true);
    expect(chart.options.scales.y.ticks.precision).toBe(0);
    expect(chart.options.scales.y.title.text).toBe('Animales');
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Cantidad' },
        parsed: { y: 3 },
      }),
    ).toBe('Cantidad: 3 animales');
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Cantidad' },
        parsed: { y: 1 },
      }),
    ).toBe('Cantidad: 1 animal');
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 0 }])[0]).toContain(
      '75',
    );
    expect(chart.options.plugins.tooltip.backgroundColor).toBe('#1c1917');
    f.destroy();
  });
  it('uses case units, integer ticks and case percentages for sanitary counts', async () => {
    const f = await fixture({
      type: 'bar',
      unit: 'cases',
      labels: ['Abiertos', 'En tratamiento', 'Cerrados'],
      tones: ['amber', 'blue', 'teal'],
      series: [{ label: 'Cantidad', values: [3, 2, 1] }],
    });
    const chart = mocked.instances[0];
    expect(chart.options.scales.y.title.text).toBe('Casos');
    expect(chart.options.scales.y.ticks.precision).toBe(0);
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Cantidad' },
        parsed: { y: 2 },
      }),
    ).toBe('Cantidad: 2 casos');
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Cantidad' },
        parsed: { y: 1 },
      }),
    ).toBe('Cantidad: 1 caso');
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 0 }])[0]).toContain(
      '50',
    );
    expect(new Set(chart.data.datasets[0].backgroundColor).size).toBe(3);
    f.destroy();
  });
  it('shows monthly reproductive counts without monetary balances or distribution percentages', async () => {
    const f = await fixture({
      type: 'bar',
      unit: 'records',
      labels: ['ene 26', 'feb 26'],
      series: [
        { label: 'Montas', tone: 'violet', values: [2, 3] },
        { label: 'Partos', tone: 'teal', values: [1, 0] },
      ],
    });
    const chart = mocked.instances[0];
    expect(chart.options.scales.y.title.text).toBe('Registros');
    expect(chart.options.scales.y.ticks.precision).toBe(0);
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Montas' },
        parsed: { y: 2 },
      }),
    ).toBe('Montas: 2 registros');
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 0 }])).toEqual([]);
    expect(chart.data.datasets[0].backgroundColor).not.toBe(chart.data.datasets[1].backgroundColor);
    f.destroy();
  });
  it('formats fractional feeding quantities with their own unit and keeps dark tooltips', async () => {
    const f = await fixture({
      type: 'bar',
      unit: 'quantity',
      unitLabel: 'sacos',
      labels: ['ene 26'],
      series: [{ label: 'Consumo', tone: 'blue', values: [1.25] }],
    });
    const chart = mocked.instances[0];
    expect(chart.options.scales.y.title.text).toBe('sacos');
    expect(chart.options.scales.y.ticks.precision).toBeUndefined();
    expect(
      chart.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Consumo' },
        parsed: { y: 1.25 },
      }),
    ).toBe('Consumo: 1.25 sacos');
    expect(chart.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 0 }])).toEqual([]);
    expect(['#20231f', '#1c1917']).toContain(chart.options.plugins.tooltip.backgroundColor);
    f.destroy();
  });
  it('compares sparse line series without inventing zero weights or selecting missing points', async () => {
    const f = await fixture({
      type: 'line',
      unit: 'kg',
      connectGaps: true,
      labels: ['a', 'b'],
      days: [20454, 20464],
      series: [
        { label: 'A', tone: 'blue', values: [20, null] },
        { label: 'B', tone: 'violet', values: [null, 24] },
      ],
    });
    const chart = mocked.instances[0];
    expect(chart.data.datasets.map((d: any) => d.data)).toEqual([
      [
        { x: 20454, y: 20 },
        { x: 20464, y: null },
      ],
      [
        { x: 20454, y: null },
        { x: 20464, y: 24 },
      ],
    ]);
    expect(chart.options.scales.y.min).toBe(18);
    expect(chart.data.datasets.every((d: any) => d.spanGaps === true && d.fill === false)).toBe(
      true,
    );
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(chart.setActiveElements).toHaveBeenLastCalledWith([{ datasetIndex: 1, index: 1 }]);
    f.componentRef.setInput('selectedIndex', 1);
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
    expect(chart.data.datasets.every((d: any) => JSON.stringify(d.pointRadius) === '[4,6]')).toBe(
      true,
    );
    f.destroy();
  });
});
