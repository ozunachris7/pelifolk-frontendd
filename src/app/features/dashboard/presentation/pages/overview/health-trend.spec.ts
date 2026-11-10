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
import { HealthTrend, HealthTrendData } from './health-trend';

const sample: HealthTrendData = {
  as_of: '2026-10-17',
  date_from: '2026-08-01',
  date_to: '2026-10-17',
  started_total: 3,
  closed_total: 2,
  event_count: 5,
  items: [
    { month: '2026-08', started: 2, closed: 0 },
    { month: '2026-09', started: 0, closed: 0 },
    { month: '2026-10', started: 1, closed: 2 },
  ],
};
let http: HttpTestingController, url: string;
let permissions = signal(['health:read']);
function fixture() {
  const f = TestBed.createComponent(HealthTrend);
  f.detectChanges();
  return f;
}
function request(): TestRequest {
  return http.expectOne((r) => r.url === url);
}
async function render(f: ComponentFixture<HealthTrend>, data = sample) {
  request().flush(data);
  await expect
    .poll(() => {
      f.detectChanges();
      return !!f.nativeElement.querySelector('details');
    })
    .toBe(true);
}
function enterDate(f: ComponentFixture<HealthTrend>, id: string, value: string) {
  const el = f.nativeElement.querySelector(id) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  f.detectChanges();
}
function submit(f: ComponentFixture<HealthTrend>) {
  f.nativeElement
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
function graph(f: ComponentFixture<HealthTrend>): InteractiveChart {
  return f.debugElement.query(By.directive(InteractiveChart)).componentInstance;
}
describe('Monthly health chart', () => {
  beforeEach(async () => {
    permissions = signal(['health:read']);
    await TestBed.configureTestingModule({
      imports: [HealthTrend],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: permissions() }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    url = `${TestBed.inject(API_URL)}/dashboard/health-trend`;
  });
  afterEach(() => http.verify());
  it('compares monthly counts, includes empty months and allows keyboard selection', async () => {
    const f = fixture();
    await render(f);
    const model = graph(f).model();
    expect(model.labels.length).toBe(3);
    expect(model.type).toBe('bar');
    expect(model.series.map((series) => series.values)).toEqual([
      [2, 0, 1],
      [0, 0, 2],
    ]);
    expect(model.unit).toBe('records');
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(graph(f).selectedIndex()).toBe(1);
    expect(f.nativeElement.querySelector('[aria-live=polite]').textContent).toContain('septiembre');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
  });
  it('sends the exact dates and removes the previous chart while fetching', async () => {
    const f = fixture();
    await render(f);
    enterDate(f, '#health-trend-from', '2024-12-10');
    enterDate(f, '#health-trend-to', '2025-02-03');
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
      started_total: 0,
      closed_total: 0,
      event_count: 0,
    });
    expect(f.nativeElement.textContent).toContain('No hay inicios ni cierres de casos registrados');
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
  });
  it('validates ordered dates and limits before requesting data', async () => {
    const f = fixture();
    await render(f);
    enterDate(f, '#health-trend-from', '2025-02-01');
    enterDate(f, '#health-trend-to', '2025-01-01');
    submit(f);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('en orden');
    http.expectNone(url);
    enterDate(f, '#health-trend-from', '2020-01-01');
    enterDate(f, '#health-trend-to', '2025-01-01');
    submit(f);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('24 meses');
    http.expectNone(url);
  });
  it('does not expose or request sanitary data without permission', () => {
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
      started_total: 0,
      closed_total: 0,
      event_count: 0,
    });
    await Promise.resolve();
    f.detectChanges();
    expect(graph(f).model().labels.length).toBe(3);
    expect(f.nativeElement.textContent).not.toContain(
      'No hay inicios ni cierres de casos registrados',
    );
  });
});
