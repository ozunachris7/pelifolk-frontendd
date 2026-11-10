import { By } from '@angular/platform-browser';
import { InteractiveChart } from '../../../../../shared/ui/chart/chart';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Session } from '../../../../../core/auth/session';
import { API_URL } from '../../../../../core/http/api-url';
import { FeedingTrend, FeedingTrendData } from './feeding-trend';

const sample: FeedingTrendData = {
  as_of: '2026-10-17',
  date_from: '2026-08-01',
  date_to: '2026-10-17',
  total_cost: '25.50',
  consumption_count: 4,
  unpriced_count: 1,
  quantities: [
    { unit_code: 'bag', quantity: '1.50' },
    { unit_code: 'kg', quantity: '12.25' },
  ],
  items: [
    {
      month: '2026-08',
      total_cost: '10.00',
      consumption_count: 2,
      unpriced_count: 1,
      quantities: [
        { unit_code: 'bag', quantity: '1.50' },
        { unit_code: 'kg', quantity: '2.25' },
      ],
    },
    {
      month: '2026-09',
      total_cost: '0.00',
      consumption_count: 0,
      unpriced_count: 0,
      quantities: [],
    },
    {
      month: '2026-10',
      total_cost: '15.50',
      consumption_count: 2,
      unpriced_count: 0,
      quantities: [{ unit_code: 'kg', quantity: '10.00' }],
    },
  ],
};
let http: HttpTestingController, url: string;
let permissions = signal(['feeding:read']);
function fixture() {
  const f = TestBed.createComponent(FeedingTrend);
  f.detectChanges();
  return f;
}
function request(): TestRequest {
  return http.expectOne((r) => r.url === url);
}
async function render(f: ComponentFixture<FeedingTrend>, data = sample) {
  request().flush(data);
  await expect
    .poll(() => {
      f.detectChanges();
      return !!f.nativeElement.querySelector('details');
    })
    .toBe(true);
}
function enterDate(f: ComponentFixture<FeedingTrend>, id: string, value: string) {
  const el = f.nativeElement.querySelector(id) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  f.detectChanges();
}
function submit(f: ComponentFixture<FeedingTrend>) {
  f.nativeElement
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
function graph(f: ComponentFixture<FeedingTrend>): InteractiveChart {
  return f.debugElement.query(By.directive(InteractiveChart)).componentInstance;
}
describe('Monthly feeding chart', () => {
  beforeEach(async () => {
    permissions = signal(['feeding:read']);
    await TestBed.configureTestingModule({
      imports: [FeedingTrend],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: permissions() }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    url = `${TestBed.inject(API_URL)}/dashboard/feeding-trend`;
  });
  afterEach(() => http.verify());
  it('separates units, includes unpriced quantities and synchronizes monthly selection', async () => {
    const f = fixture();
    await render(f);
    const charts = f.debugElement
      .queryAll(By.directive(InteractiveChart))
      .map((c) => c.componentInstance as InteractiveChart);
    expect(charts.length).toBe(2);
    expect(charts[0].model().series[0].values).toEqual([10, 0, 15.5]);
    expect(charts[0].model().unit).toBe('MXN');
    expect(charts[1].model().unitLabel).toBe('sacos');
    expect(charts[1].model().series[0].values).toEqual([1.5, 0, 0]);
    const select = f.nativeElement.querySelector('#feeding-trend-unit') as HTMLSelectElement;
    select.value = 'kg';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    expect(charts[1].model().unitLabel).toBe('kg');
    expect(charts[1].model().series[0].values).toEqual([2.25, 0, 10]);
    expect(f.nativeElement.textContent).toContain('El costo es parcial');
    const canvas = f.nativeElement.querySelector('[data-testid=feeding-quantity-chart] canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(charts.every((c) => c.selectedIndex() === 1)).toBe(true);
    expect(f.nativeElement.querySelector('[aria-live=polite]').textContent).toContain('septiembre');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
  });
  it('keeps quantities visible when all costs are unknown and treats a free price as known', async () => {
    const f = fixture();
    await render(f, { ...sample, unpriced_count: 4, total_cost: '0.00' });
    expect(f.nativeElement.querySelector('[data-testid=feeding-cost-chart] canvas')).toBeNull();
    expect(
      f.nativeElement.querySelector('[data-testid=feeding-quantity-chart] canvas'),
    ).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('ninguno de los consumos tiene precio');
    f.componentRef.setInput('refreshToken', 1);
    f.detectChanges();
    await render(f, {
      ...sample,
      unpriced_count: 0,
      total_cost: '0.00',
      items: sample.items.map((row) => ({ ...row, total_cost: '0.00', unpriced_count: 0 })),
    });
    expect(f.nativeElement.querySelector('[data-testid=feeding-cost-chart] canvas')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('El costo es parcial');
  });
  it('sends the exact dates and removes the previous chart while fetching', async () => {
    const f = fixture();
    await render(f);
    enterDate(f, '#feeding-trend-from', '2024-12-10');
    enterDate(f, '#feeding-trend-to', '2025-02-03');
    submit(f);
    const req = request();
    expect(req.request.params.get('date_from')).toBe('2024-12-10');
    expect(req.request.params.get('date_to')).toBe('2025-02-03');
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
    req.flush({ ...sample, date_from: '2024-12-10', date_to: '2025-02-03' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('10/12/2024');
  });
  it('shows a useful empty state without inventing bars', async () => {
    const f = fixture();
    await render(f, {
      ...sample,
      items: [],
      total_cost: '0.00',
      consumption_count: 0,
      unpriced_count: 0,
      quantities: [],
    });
    expect(f.nativeElement.textContent).toContain('No hay consumos registrados');
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
  });
  it('validates ordered dates and limits before requesting data', async () => {
    const f = fixture();
    await render(f);
    enterDate(f, '#feeding-trend-from', '2025-02-01');
    enterDate(f, '#feeding-trend-to', '2025-01-01');
    submit(f);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('en orden');
    http.expectNone(url);
    enterDate(f, '#feeding-trend-from', '2020-01-01');
    enterDate(f, '#feeding-trend-to', '2025-01-01');
    submit(f);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('24 meses');
    http.expectNone(url);
  });
  it('does not expose or request feeding data without permission', () => {
    permissions.set([]);
    const f = fixture();
    expect(f.nativeElement.querySelector('section')).toBeNull();
    http.expectNone(url);
  });
  it('offers retry after an error and refreshes with the overview', async () => {
    const f = fixture();
    request().flush({}, { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[role=alert]');
      })
      .toBe(true);
    f.nativeElement.querySelector('[role=alert] button').click();
    f.detectChanges();
    await render(f);
    f.componentRef.setInput('refreshToken', 1);
    f.detectChanges();
    await render(f);
  });
  it('keeps the latest response if an earlier refresh finishes later', async () => {
    const f = fixture();
    const older = request();
    f.componentRef.setInput('refreshToken', 1);
    f.detectChanges();
    await render(f);
    older.flush({
      ...sample,
      items: [],
      total_cost: '0.00',
      consumption_count: 0,
      unpriced_count: 0,
      quantities: [],
    });
    await Promise.resolve();
    f.detectChanges();
    expect(graph(f).model().labels.length).toBe(3);
    expect(f.nativeElement.textContent).not.toContain('No hay consumos registrados');
  });
  it('switches presets and clears data on permission revocation', async () => {
    const f = fixture();
    await render(f);
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('3 meses'))
      .click();
    f.detectChanges();
    const req = request();
    const start = req.request.params.get('date_from')!,
      finish = req.request.params.get('date_to')!;
    expect(
      (Number(finish.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
        Number(finish.slice(5, 7)) -
        Number(start.slice(5, 7)) +
        1,
    ).toBe(3);
    req.flush(sample);
    await f.whenStable();
    f.detectChanges();
    permissions.set([]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('section')).toBeNull();
  });
});
