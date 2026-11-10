import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { HealthRepository } from '../infrastructure/health-repository';
import { HealthList } from './health-list';
const animal = { id: '30000000-0000-4000-8000-000000000001', name: 'Luna', siniiga: 'MX123' };
const CASE = {
  id: '60000000-0000-4000-8000-000000000001',
  animal,
  reason: 'Cojera',
  status: 'open',
  start_date: '2024-01-01',
  closed_date: null,
  notes: null,
};
const USER: SessionUser = {
  id: 'owner',
  name: 'Cris',
  middle_name: null,
  paternal_lastname: 'Ozuna',
  maternal_lastname: 'Vazquez',
  email: 'owner@example.com',
  phone: null,
  active: true,
  role_id: 'owner-role',
  role_name: 'owner',
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
};
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<HealthList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<HealthList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<HealthList>, id: string, value: string) {
  const el = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  f.detectChanges();
}
async function signedIn(permissions = USER.permissions) {
  const promise = TestBed.inject(Session).login(USER.email, 'Test-password123');
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await promise;
}
async function fixture() {
  const f = TestBed.createComponent(HealthList);
  f.detectChanges();
  http
    .expectOne((r) => r.url === `${api}/health/cases`)
    .flush({ items: [CASE], total: 1, offset: 0, limit: 25 });
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).querySelectorAll('[data-case-id]').length;
    })
    .toBe(1);
  return f;
}
describe('Health management', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [HealthList],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        HealthRepository,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http
      .match((r) => r.url.endsWith('/health/reactions'))
      .forEach((r) => {
        expect(r.request.params.get('animal_id')).toBe(CASE.animal.id);
        r.flush({ items: [], total: 0, offset: 0, limit: 5 });
      });
    http
      .match((r) => r.url.endsWith('/health/incidents'))
      .forEach((r) => {
        expect(r.request.params.get('animal_id')).toBe(CASE.animal.id);
        r.flush({ items: [], total: 0, offset: 0, limit: 5 });
      });
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('allows observations without allowing case management or clinical actions', async () => {
    await signedIn(['health:read', 'health:observations:create']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-observation]')).not.toBeNull();
    expect(element(f).querySelector('[data-testid=new-case]')).toBeNull();
    const c = f.componentInstance as any;
    expect(c.canDiagnose()).toBe(false);
    expect(c.canTreat()).toBe(false);
    expect(c.canDose()).toBe(false);
    expect(c.canFollowup()).toBe(false);
    c.openForm('case');
    f.detectChanges();
    expect(c.formKind()).toBeNull();
  });
  it('separates indications from actual doses and case state', async () => {
    await signedIn(['health:read', 'health:treatments:create']);
    const f = await fixture();
    const c = f.componentInstance as any;
    expect(c.canTreat()).toBe(true);
    expect(c.canDose()).toBe(false);
    expect(c.canCases()).toBe(false);
    expect(c.canDiagnose()).toBe(false);
  });
  it('hides registration for readers and makes no health requests without access', async () => {
    await signedIn([]);
    const denied = TestBed.createComponent(HealthList);
    denied.detectChanges();
    expect(element(denied).textContent).toContain('No tienes permiso');
    http.expectNone((r) => r.url.includes('/health/'));
    denied.destroy();
    await signedIn(['health:read']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-case]')).toBeNull();
    expect(element(f).querySelector('button[aria-label^="Ver caso"]')).toBeTruthy();
  });
  it('registers an observation with cookie authentication and opens the history', async () => {
    await signedIn();
    const f = await fixture();
    click(f, '[data-testid=new-observation]');
    http.expectOne((r) => r.url === `${api}/health/animal-options`).flush([animal]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#health-animal')?.options.length;
      })
      .toBe(2);
    fill(f, 'health-animal', animal.id);
    fill(f, 'health-date', '2024-01-02');
    fill(f, 'health-text', '  Camina con dificultad  ');
    element(f)
      .querySelector('app-detail-page form, dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/observations`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      animal_id: animal.id,
      date: '2024-01-02',
      observation: 'Camina con dificultad',
    });
    const observation = {
      id: 'o1',
      animal,
      date: '2024-01-02',
      observation: 'Camina con dificultad',
      recorded_by: 'Cris',
    };
    req.flush(observation);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/health/observations`)
            .map((r) => {
              r.flush({ items: [observation], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelectorAll('[data-observation-id]').length;
      })
      .toBe(1);
    click(f, 'button[aria-label^="Historial sanitario"]');
    http
      .expectOne(`${api}/health/animals/${animal.id}/history`)
      .flush({ animal, cases: [CASE], observations: [observation] });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f)
          .querySelector('app-detail-page, dialog')
          ?.textContent?.includes('Camina con dificultad');
      })
      .toBe(true);
  });
  it('requires a valid closing date and preserves the dialog on stale status conflict', async () => {
    await signedIn();
    const f = await fixture();
    click(f, 'button[aria-label^="Ver caso"]');
    http.expectOne(`${api}/health/cases/${CASE.id}`).flush({ case: CASE, activity: [] });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('#health-status');
      })
      .toBe(true);
    fill(f, 'health-status', 'closed');
    fill(f, 'health-closed-date', '2023-12-31');
    element(f)
      .querySelector('app-detail-page form, dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    http.expectNone((r) => r.method === 'PATCH');
    expect(element(f).textContent).toContain('El cierre debe estar');
    fill(f, 'health-closed-date', '2024-01-03');
    element(f)
      .querySelector('app-detail-page form, dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/cases/${CASE.id}/status`);
    expect(req.request.body).toEqual({
      expected_status: 'open',
      status: 'closed',
      closed_date: '2024-01-03',
    });
    req.flush(
      { detail: 'Health case changed; reload before updating' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f)
          .querySelector('app-detail-page, dialog')
          ?.textContent?.includes('El caso cambió');
      })
      .toBe(true);
  });
  it('registers a diagnosis on the case and displays its severity and author', async () => {
    await signedIn();
    const f = await fixture();
    click(f, 'button[aria-label^="Ver caso"]');
    http
      .expectOne(`${api}/health/cases/${CASE.id}`)
      .flush({ case: CASE, activity: [], diagnoses: [] });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('[data-testid=new-diagnosis]');
      })
      .toBe(true);
    click(f, '[data-testid=new-diagnosis]');
    fill(f, 'diagnosis-date', '2024-01-03');
    fill(f, 'diagnosis-severity', 'moderate');
    fill(f, 'diagnosis-text', '  Inflamación de extremidad  ');
    element(f)
      .querySelector('#diagnosis-text')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/cases/${CASE.id}/diagnoses`);
    expect(req.request.body).toEqual({
      date: '2024-01-03',
      severity: 'moderate',
      diagnosis: 'Inflamación de extremidad',
    });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    const diagnosis = {
      id: 'd1',
      health_case_id: CASE.id,
      animal,
      date: '2024-01-03',
      severity: 'moderate',
      diagnosis: 'Inflamación de extremidad',
      recorded_by: 'Cris Ozuna',
    };
    req.flush(diagnosis);
    await expect
      .poll(
        () =>
          http.match(`${api}/health/cases/${CASE.id}`).map((r) => {
            r.flush({ case: CASE, activity: [], diagnoses: [diagnosis] });
            return true;
          }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f)
          .querySelector('app-detail-page, dialog')
          ?.textContent?.includes('Inflamación de extremidad');
      })
      .toBe(true);
    expect(element(f).querySelector('app-detail-page, dialog')?.textContent).toContain('Moderada');
    expect(element(f).querySelector('app-detail-page, dialog')?.textContent).toContain(
      'Cris Ozuna',
    );
  });
  it('registers a treatment and refreshes the case to under treatment', async () => {
    await signedIn();
    const f = await fixture();
    click(f, 'button[aria-label^="Ver caso"]');
    http
      .expectOne(`${api}/health/cases/${CASE.id}`)
      .flush({ case: CASE, activity: [], diagnoses: [], treatments: [] });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('[data-testid=new-treatment]');
      })
      .toBe(true);
    click(f, '[data-testid=new-treatment]');
    const product = {
      id: 'p1',
      name: 'Producto de prueba',
      product_type_id: 1,
      product_type_name: 'medicine',
      unit_id: 1,
      unit_code: 'ml',
      withdrawal_days: 7,
      active: true,
    };
    http.expectOne(`${api}/health/catalogs`).flush({
      product_types: [{ id: 1, name: 'medicine' }],
      units: [{ id: 1, code: 'ml' }],
      routes: [{ id: 1, name: 'oral' }],
    });
    http
      .expectOne((r) => r.url === `${api}/health/products`)
      .flush({ items: [product], total: 1, offset: 0, limit: 100 });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#treatment-product')?.options.length;
      })
      .toBe(2);
    fill(f, 'treatment-product', 'p1');
    fill(f, 'treatment-start', '2024-01-03');
    fill(f, 'treatment-dose', '2.125');
    fill(f, 'treatment-duration', '3');
    fill(f, 'treatment-frequency', '12');
    for (const id of ['treatment-unit', 'treatment-route']) {
      const el = element(f).querySelector<HTMLSelectElement>(`#${id}`)!;
      el.selectedIndex = 1;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    f.detectChanges();
    element(f)
      .querySelector('#treatment-dose')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/cases/${CASE.id}/treatments`);
    expect(req.request.body).toEqual({
      product_id: 'p1',
      start_date: '2024-01-03',
      dose_value: 2.125,
      dose_unit_id: 1,
      route_id: 1,
      frequency_hours: 12,
      duration_days: 3,
    });
    const treatment = {
      ...req.request.body,
      id: 't1',
      health_case_id: CASE.id,
      animal,
      product,
      end_date: '2024-01-06',
      last_day: '2024-01-05',
      dose_unit_code: 'ml',
      route_name: 'oral',
      recorded_by: 'Cris Ozuna',
    };
    req.flush(treatment);
    await expect
      .poll(
        () =>
          http.match(`${api}/health/cases/${CASE.id}`).map((r) => {
            r.flush({
              case: { ...CASE, status: 'under_treatment' },
              activity: [],
              diagnoses: [],
              treatments: [treatment],
            });
            return true;
          }).length,
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/health/cases`)
            .map((r) => {
              r.flush({
                items: [{ ...CASE, status: 'under_treatment' }],
                total: 1,
                offset: 0,
                limit: 25,
              });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f)
          .querySelector('app-detail-page, dialog')
          ?.textContent?.includes('Producto de prueba');
      })
      .toBe(true);
    expect(element(f).querySelector('app-detail-page, dialog')?.textContent).toContain(
      '05/01/2024',
    );
  });
  it('opens a linked case from an observation and displays its original author', async () => {
    await signedIn();
    const f = await fixture();
    click(f, '[data-testid=observations-tab]');
    const source = {
      id: 'o1',
      animal,
      date: '2024-01-01',
      observation: 'Hallazgo original.',
      recorded_by: 'Trabajador',
      health_case: null,
    };
    http
      .expectOne((r) => r.url === `${api}/health/observations`)
      .flush({ items: [source], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('[data-attend-observation]');
      })
      .toBe(true);
    click(f, '[data-attend-observation]');
    fill(f, 'source-case-date', '2024-01-01');
    fill(f, 'source-case-reason', 'Cojera');
    element(f)
      .querySelector('app-observation-case form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne((r) => r.url === `${api}/health/cases` && r.method === 'POST');
    expect(req.request.body.observation_id).toBe('o1');
    req.flush(CASE);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/health/observations`)
            .map((r) => {
              r.flush({
                items: [{ ...source, health_case: CASE }],
                total: 1,
                offset: 0,
                limit: 25,
              });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          http.match(`${api}/health/cases/${CASE.id}`).map((r) => {
            r.flush({ case: CASE, activity: [], observations: [source] });
            return true;
          }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[data-source-observation]')?.textContent;
      })
      .toContain('Trabajador');
    expect(element(f).querySelector('[data-source-observation]')?.textContent).toContain(
      'Hallazgo original.',
    );
    expect(element(f).querySelector('app-observation-case')).toBeNull();
  });
  it('opens the case as a page and preserves the list filters when returning', async () => {
    await signedIn(['health:read']);
    const f = await fixture();
    fill(f, 'health-search', 'Luna');
    click(f, 'button[aria-label^="Ver caso"]');
    expect(element(f).querySelector('app-detail-page')).not.toBeNull();
    expect(element(f).querySelector('dialog')).toBeNull();
    expect(element(f).querySelector('#health-search')).toBeNull();
    http.expectOne(`${api}/health/cases/${CASE.id}`).flush({
      case: CASE,
      diagnoses: [],
      treatments: [],
      activity: [],
      observations: [],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('app-detail-page')?.textContent;
      })
      .toContain('Cojera');
    click(f, 'app-detail-page header button');
    expect(element(f).querySelector('app-detail-page')).toBeNull();
    expect(element(f).querySelector<HTMLInputElement>('#health-search')?.value).toBe('Luna');
    expect(element(f).querySelector('[data-case-id]')).not.toBeNull();
    http.expectNone((r) => r.url === `${api}/health/cases`);
  });
});
