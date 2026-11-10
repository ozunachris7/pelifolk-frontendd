import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { HealthReport } from './health-report';
import { ReportHome } from './report-home';
const page = {
  as_of: '2026-10-10',
  kind: 'cases',
  items: [],
  total: 0,
  counts: {},
  offset: 0,
  limit: 25,
};
describe('Health report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['health:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(HealthReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/health/options`)
      .flush({ animals: [], programs: [] });
    http.expectOne((r) => r.url === `${url}/reports/health`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 casos');
    return f;
  }
  it('resets case filters when switching to program notices', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const status = f.nativeElement.querySelector('#health-report-status');
    status.value = 'closed';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    f.nativeElement.querySelector('[data-health-tab=schedule]').click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url === `${url}/reports/health`);
    expect(r.request.params.get('kind')).toBe('schedule');
    expect(r.request.params.get('status')).toBe('attention');
    expect(r.request.params.has('date_from')).toBe(false);
    r.flush({ ...page, kind: 'schedule' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 avisos');
  });
  it('rejects invalid date ranges without requesting data', async () => {
    const f = await fixture();
    for (const [id, value] of [
      ['health-report-from', '2026-10-10'],
      ['health-report-to', '2026-10-01'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Desde debe ser anterior');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/reports/health'));
  });
  it('opens only sanidad for a role with health read permission', () => {
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-health-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-animal-report')).toBeNull();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/health/options`)
      .flush({ animals: [], programs: [] });
    http.expectOne((r) => r.url === `${url}/reports/health`).flush(page);
    http.expectNone((r) => r.url.includes('/reports/animals'));
  });
});
