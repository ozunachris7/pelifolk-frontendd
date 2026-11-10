import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { WeightReport } from './weight-report';
import { ReportHome } from './report-home';
import { navigationFor } from '../../shared/ui/sidebar/navigation';
const page = {
  as_of: '2026-10-10',
  date_from: null,
  date_to: null,
  total: 1,
  animal_count: 1,
  comparable_count: 1,
  loss_count: 1,
  offset: 0,
  limit: 25,
  items: [
    {
      id: 'w1',
      animal: { id: 'a1', name: 'Luna', siniiga: 'MX123' },
      date: '2024-01-21',
      weight_kg: '31.50',
      previous_date: '2024-01-11',
      previous_weight_kg: '32.50',
      days: 10,
      gain_kg: '-1.00',
      daily_gain_kg: '-0.100',
      recorded_by: 'Cristopher Ozuna',
      notes: null,
    },
  ],
};
describe('Weight report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeightReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['weights:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(WeightReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/weights/options`)
      .flush({ animals: [{ id: 'a1', name: 'Luna', siniiga: 'MX123' }] });
    http.expectOne((r) => r.url === `${url}/reports/weights`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('-0.100');
    return f;
  }
  it('shows previous measurement and losses, and rejects reversed dates locally', async () => {
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('11/01/2024');
    for (const [id, value] of [
      ['weight-report-from', '2024-02-01'],
      ['weight-report-to', '2024-01-01'],
    ]) {
      const input = f.nativeElement.querySelector('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('La fecha Desde debe ser anterior');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/reports/weights'));
  });
  it('exports applied filters rather than pending changes', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const input = f.nativeElement.querySelector('#weight-report-q');
    input.value = 'Luna';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/reports/weights`);
    expect(req.request.params.get('q')).toBe('Luna');
    req.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[data-weight-row]');
      })
      .toBe(true);
    input.value = 'Otro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Descargar Excel'))!
      .click();
    const x = http.expectOne((r) => r.url === `${url}/reports/weights/export`);
    expect(x.request.params.get('q')).toBe('Luna');
    x.flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('opens the report and sidebar link with only weights read permission', () => {
    expect(navigationFor(['weights:read']).some((n) => n.path === 'reports')).toBe(true);
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-weight-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-animal-report')).toBeNull();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http.expectOne((r) => r.url === `${url}/reports/weights/options`).flush({ animals: [] });
    http.expectOne((r) => r.url === `${url}/reports/weights`).flush(page);
  });
});
