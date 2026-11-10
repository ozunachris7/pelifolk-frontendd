import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { WeaningReport } from './weaning-report';
import { ReportHome } from './report-home';
import { navigationFor } from '../../shared/ui/sidebar/navigation';
const page = {
  as_of: '2026-10-14',
  date_from: null,
  date_to: null,
  total: 1,
  offset: 0,
  limit: 25,
  items: [
    {
      id: 'w1',
      animal: { id: 'a1', name: 'Estrella', siniiga: 'MX123' },
      mother: { id: 'm1', name: 'Luna', siniiga: null },
      date: '2026-10-14',
      weight_kg: '18.50',
      age_days: 74,
      birth_date_snapshot: '2026-08-01',
      recorded_by: 'Cristopher Ozuna',
      notes: null,
    },
  ],
};
describe('Weaning report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaningReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['weights:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(WeaningReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/weanings/options`)
      .flush({ animals: [{ id: 'a1', name: 'Luna', siniiga: 'MX123' }] });
    http.expectOne((r) => r.url === `${url}/reports/weanings`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('74 días');
    return f;
  }
  it('shows mother and age at weaning, and rejects reversed dates locally', async () => {
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('Luna');
    expect(f.nativeElement.textContent).toContain('18.50 kg');
    for (const [id, value] of [
      ['weaning-report-from', '2024-02-01'],
      ['weaning-report-to', '2024-01-01'],
    ]) {
      const input = f.nativeElement.querySelector('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('La fecha Desde debe ser anterior');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/reports/weanings'));
  });
  it('exports applied filters rather than pending changes', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const input = f.nativeElement.querySelector('#weaning-report-q');
    input.value = 'Luna';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/reports/weanings`);
    expect(req.request.params.get('q')).toBe('Luna');
    req.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[data-weaning-report-row]');
      })
      .toBe(true);
    input.value = 'Otro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Descargar Excel'))!
      .click();
    const x = http.expectOne((r) => r.url === `${url}/reports/weanings/export`);
    expect(x.request.params.get('q')).toBe('Luna');
    x.flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('opens the weaning tab with only weights read permission', async () => {
    expect(navigationFor(['weights:read']).some((n) => n.path === 'reports')).toBe(true);
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http.expectOne((r) => r.url === `${url}/reports/weights/options`).flush({ animals: [] });
    http.expectOne((r) => r.url === `${url}/reports/weights`).flush({ ...page, items: [] });
    const tab = [...f.nativeElement.querySelectorAll('[role=tab]')].find(
      (b: any) => b.textContent.trim() === 'Destetes',
    ) as HTMLButtonElement;
    tab.click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-weaning-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-weight-report')).toBeNull();
    http.expectOne((r) => r.url === `${url}/reports/weanings/options`).flush({ animals: [] });
    http.expectOne((r) => r.url === `${url}/reports/weanings`).flush(page);
    await f.whenStable();
  });
  it('shows unknown mother and age without inventing zero values', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    http
      .expectOne((r) => r.url === `${url}/reports/weanings`)
      .flush({ ...page, items: [{ ...page.items[0], mother: null, age_days: null }] });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Desconocida');
    expect(f.nativeElement.textContent).toContain('Sin registrar');
    expect(f.nativeElement.textContent).not.toContain('0 días');
  });
  it('does not query reports without permission', () => {
    TestBed.overrideProvider(Session, { useValue: { user: () => ({ permissions: [] }) } });
    const f = TestBed.createComponent(WeaningReport);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/reports/weanings'));
  });
});
