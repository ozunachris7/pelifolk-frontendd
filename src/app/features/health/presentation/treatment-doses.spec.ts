import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { TreatmentDoses } from './treatment-doses';
const treatment = {
  id: 't1',
  animal: { id: 'a1', name: 'Estrella', siniiga: null },
  product: { id: 'p1', name: 'Producto registrado' },
  health_case_id: 'c1',
  program_id: null,
  program_name: null,
  start_date: '2024-01-03',
  last_day: '2024-01-03',
  dose_value: 2,
  dose_unit_id: 1,
  dose_unit_code: 'ml',
  route_id: 1,
  route_name: 'oral',
};
const catalogs = {
  units: [{ id: 1, code: 'ml' }],
  routes: [{ id: 1, name: 'oral' }],
  product_types: [],
};
const empty = { items: [], total: 0, offset: 0, limit: 25 };
const applied = {
  id: 'd1',
  applied_at: '2024-01-03T10:00:00-06:00',
  administered_by: 'Veterinario responsable',
  dose_value: '2.000',
  dose_unit_code: 'ml',
  route_name: 'oral',
  notes: null,
  is_deviation: false,
  recorded_by: 'Cristopher Ozuna',
};
describe('Actual treatment doses', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreatmentDoses],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        {
          provide: Session,
          useValue: {
            user: () => ({
              name: 'Cristopher',
              paternal_lastname: 'Ozuna',
              permissions: [
                'health:read',
                'health:observations:create',
                'health:cases:write',
                'health:diagnoses:create',
                'health:treatments:create',
                'health:doses:create',
                'health:followups:create',
                'health:products:write',
                'health:programs:write',
                'health:program_applications:create',
                'health:reactions:write',
                'health:incidents:write',
              ],
            }),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture(write = true) {
    const f = TestBed.createComponent(TreatmentDoses);
    f.componentRef.setInput('treatment', treatment);
    f.componentRef.setInput('canWrite', write);
    f.detectChanges();
    return f;
  }
  async function expand(f: any) {
    f.nativeElement.querySelector('[data-dose-ledger]').click();
    f.detectChanges();
    http.expectOne((r) => r.url === '/api/health/treatments/t1/products/p1/doses').flush(empty);
    await f.whenStable();
    f.detectChanges();
  }
  async function start(f: any) {
    f.nativeElement.querySelector('[data-new-dose]').click();
    f.detectChanges();
    http.expectOne('/api/health/catalogs').flush(catalogs);
    await f.whenStable();
    f.detectChanges();
  }
  function fill(f: any, selector: string, value: string) {
    const e = f.nativeElement.querySelector(selector);
    e.value = value;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    f.detectChanges();
  }
  function submit(f: any) {
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
  }
  it('does not infer doses from a prescription and supports read-only history', async () => {
    const f = fixture(false);
    http.expectNone((r) => r.url.includes('/doses'));
    await expand(f);
    expect(f.nativeElement.textContent).toContain('Sin dosis aplicadas registradas');
    expect(f.nativeElement.querySelector('[data-new-dose]')).toBeNull();
  });
  it('records observed quantity and responsible separately and refreshes the ledger', async () => {
    const f = fixture(),
      busy = vi.fn();
    f.componentInstance.busyChange.subscribe(busy);
    await expand(f);
    await start(f);
    fill(f, '[data-dose-time]', '2024-01-03T10:00');
    fill(f, '[data-dose-quantity]', '2');
    fill(f, '[data-dose-responsible]', 'Veterinario responsable');
    submit(f);
    const req = http.expectOne(
      (r) => r.url === '/api/health/treatments/t1/products/p1/doses' && r.method === 'POST',
    );
    expect(req.request.body).toEqual({
      applied_at: expect.stringMatching(/^2024-01-03T10:00:00[+-]\d{2}:\d{2}$/),
      administered_by: 'Veterinario responsable',
      dose_value: '2',
      dose_unit_id: 1,
      route_id: 1,
      notes: null,
    });
    expect(busy).toHaveBeenLastCalledWith(true);
    req.flush(applied);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url.endsWith('/doses') && r.method === 'GET')
            .map((r) => {
              r.flush({ ...empty, items: [applied], total: 1 });
              return true;
            }).length,
      )
      .toBe(1);
    await f.whenStable();
    f.detectChanges();
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(f.nativeElement.textContent).toContain('Aplicada por Veterinario responsable');
    expect(f.nativeElement.textContent).toContain('Capturada por Cristopher Ozuna');
    expect(f.nativeElement.textContent).toContain('10:00 (UTC-06:00)');
  });
  it('requires an explanation for variation and keeps data on duplicate conflicts', async () => {
    const f = fixture();
    await expand(f);
    await start(f);
    fill(f, '[data-dose-time]', '2024-01-03T10:00');
    fill(f, '[data-dose-quantity]', '1.5');
    submit(f);
    http.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.textContent).toContain('Explica en las notas');
    fill(f, '[data-dose-notes]', 'Cantidad realmente aplicada.');
    submit(f);
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'Dose already recorded at this time' },
        { status: 409, statusText: 'Conflict' },
      );
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Ya hay una dosis registrada');
    expect(f.nativeElement.querySelector('[data-dose-quantity]').value).toBe('1.5');
  });
  it('does not let a stale product reply overwrite another product ledger', async () => {
    const f = fixture();
    f.nativeElement.querySelector('[data-dose-ledger]').click();
    f.detectChanges();
    const old = http.expectOne((r) => r.url.endsWith('/products/p1/doses'));
    f.componentRef.setInput('treatment', {
      ...treatment,
      product: { id: 'p2', name: 'Otro producto' },
    });
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/products/p2/doses')).flush(empty);
    await f.whenStable();
    f.detectChanges();
    old.flush({ ...empty, total: 1, items: [applied] });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin dosis aplicadas registradas');
    expect(f.nativeElement.querySelector('[data-dose-entry]')).toBeNull();
  });
});
