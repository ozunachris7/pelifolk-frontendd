import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { FeedingReport } from './feeding-report';
import { ReportHome } from './report-home';
const page = {
  as_of: '2026-10-10',
  date_from: '2024-06-01',
  date_to: '2024-06-02',
  items: [],
  total: 0,
  total_cost: '0.00',
  unpriced_count: 0,
  quantities: [],
  offset: 0,
  limit: 25,
};
describe('Finance report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedingReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['feeding:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(FeedingReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/feeding/options`)
      .flush({
        feeds: [],
        targets: [],
      });
    http.expectOne((r) => r.url === `${url}/reports/feeding`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 consumos');
    return f;
  }
  it('clears the animal selection when changing to a group and preserves units', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const kind = f.nativeElement.querySelector('#feeding-report-kind');
    kind.value = 'animal';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    http
      .expectOne((r) => r.url === `${url}/reports/feeding/options`)
      .flush({ feeds: [], targets: [{ id: 'a1', name: 'Luna', siniiga: 'MX123' }] });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#feeding-report-target option[value=a1]');
      })
      .toBeTruthy();
    const target = f.nativeElement.querySelector('#feeding-report-target');
    target.value = 'a1';
    target.dispatchEvent(new Event('change', { bubbles: true }));
    kind.value = 'group';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/reports/feeding/options`);
    expect(req.request.params.get('target_kind')).toBe('group');
    req.flush({ feeds: [], targets: [{ id: 'g1', name: 'Reproductoras', siniiga: null }] });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#feeding-report-target option[value=g1]');
      })
      .toBeTruthy();
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const report = http.expectOne((r) => r.url === `${url}/reports/feeding`);
    expect(report.request.params.get('target_kind')).toBe('group');
    expect(report.request.params.has('target_id')).toBe(false);
    report.flush({
      ...page,
      quantities: [
        { unit_code: 'kg', quantity: '5.50' },
        { unit_code: 'bag', quantity: '2.00' },
      ],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-testid=feeding-unit-totals]').textContent;
      })
      .toContain('saco');
    expect(
      f.nativeElement.querySelector('[data-testid=feeding-unit-totals]').textContent,
    ).toContain('kg');
  });
  it('exports the applied filters while retaining the applied selection', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const input = f.nativeElement.querySelector('#feeding-report-q');
    input.value = 'Compra';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/reports/feeding`);
    expect(req.request.params.get('q')).toBe('Compra');
    req.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[data-testid=feeding-unit-totals]');
      })
      .toBe(true);
    input.value = 'Otro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Descargar Excel'))!
      .click();
    const x = http.expectOne((r) => r.url === `${url}/reports/feeding/export`);
    expect(x.request.params.get('q')).toBe('Compra');
    x.flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('opens feeding with feeding read permission', () => {
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-feeding-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-animal-report')).toBeNull();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/feeding/options`)
      .flush({ feeds: [], targets: [] });
    http.expectOne((r) => r.url === `${url}/reports/feeding`).flush(page);
  });
});
