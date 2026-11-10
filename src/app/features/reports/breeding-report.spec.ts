import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { BreedingReport } from './breeding-report';
import { ReportHome } from './report-home';
const page = {
  as_of: '2026-10-10',
  kind: 'mating',
  items: [],
  total: 0,
  counts: {},
  offset: 0,
  limit: 25,
};
describe('Breeding report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreedingReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['breeding:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(BreedingReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http.expectOne((r) => r.url === `${url}/reports/breeding/options`).flush({ animals: [] });
    http.expectOne((r) => r.url === `${url}/reports/breeding`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 montas');
    return f;
  }
  it('shows offspring details and clears diagnosis results on switching tabs', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    f.nativeElement.querySelector('[data-breeding-tab=pregnancy]').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url === `${url}/reports/breeding`)
      .flush({ ...page, kind: 'pregnancy' });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('#breeding-report-result');
      })
      .toBe(true);
    const result = f.nativeElement.querySelector('#breeding-report-result');
    result.value = 'pregnant';
    result.dispatchEvent(new Event('change', { bubbles: true }));
    f.nativeElement.querySelector('[data-breeding-tab=birth]').click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url === `${url}/reports/breeding`);
    expect(r.request.params.get('kind')).toBe('birth');
    expect(r.request.params.has('result')).toBe(false);
    r.flush({
      ...page,
      kind: 'birth',
      total: 1,
      counts: { alive: 1, stillborn: 0 },
      items: [
        {
          id: 'e1',
          kind: 'birth',
          animal: { id: 'a1', name: 'Luna', siniiga: 'MX1', sex: 'female' },
          date: '2024-06-01',
          recorded_by: 'Cris',
          notes: null,
          male: null,
          result: null,
          mating_event_id: null,
          birth_type: 'natural',
          offspring: [
            {
              animal: { id: 'a2', name: 'Estrella', siniiga: 'MX2', sex: 'female' },
              alive: true,
              birth_weight_kg: '3.25',
            },
          ],
        },
      ],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Estrella');
    expect(f.nativeElement.textContent).toContain('3.25 kg');
  });
  it('rejects invalid date ranges without requesting data', async () => {
    const f = await fixture();
    for (const [id, value] of [
      ['breeding-report-from', '2026-10-10'],
      ['breeding-report-to', '2026-10-01'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Desde debe ser anterior');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/reports/breeding'));
  });
  it('opens reproduction for a role with only breeding read permission', () => {
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-breeding-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-animal-report')).toBeNull();
    expect(f.nativeElement.querySelector('app-health-report')).toBeNull();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http.expectOne((r) => r.url === `${url}/reports/breeding/options`).flush({ animals: [] });
    http.expectOne((r) => r.url === `${url}/reports/breeding`).flush(page);
  });
});
