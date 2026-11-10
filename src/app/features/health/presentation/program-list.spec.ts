import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { HealthRepository } from '../infrastructure/health-repository';
import { ProgramList } from './program-list';
const PRODUCT = {
  id: 'p1',
  name: 'Vacuna registrada',
  product_type_id: 1,
  product_type_name: 'vaccine',
  unit_id: 1,
  unit_code: 'ml',
  withdrawal_days: 0,
  active: true,
};
const PROGRAM = {
  id: 'hp1',
  name: 'Programa sanitario',
  product: PRODUCT,
  interval_days: 90,
  minimum_age_days: 30,
  sex: null,
  notice_days: 7,
  active: true,
};
const ANIMAL = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const NOTICE = {
  animal: ANIMAL,
  birth_date: '2023-01-01',
  last_application: null,
  due_date: '2023-01-31',
  days_remaining: -1,
  status: 'overdue',
  can_apply: true,
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
function element(f: ComponentFixture<ProgramList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<ProgramList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<ProgramList>, id: string, value: string) {
  const el = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, 'Test-password123');
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await pending;
}
async function fixture() {
  const f = TestBed.createComponent(ProgramList);
  f.detectChanges();
  http
    .expectOne((r) => r.url === `${api}/health/programs`)
    .flush({ items: [PROGRAM], total: 1, offset: 0, limit: 25 });
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).querySelectorAll('[data-program-id]').length;
    })
    .toBe(1);
  return f;
}
describe('Health programs', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [ProgramList],
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
      .forEach((r) => r.flush({ items: [], total: 0, offset: 0, limit: 5 }));
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('does not request protected data without access and hides writes for readers', async () => {
    await login([]);
    const denied = TestBed.createComponent(ProgramList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes('/health/'));
    expect(element(denied).textContent).toContain('No tienes permiso');
    denied.destroy();
    await login(['health:read']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-program]')).toBeNull();
    click(f, 'button[aria-label^="Ver avisos"]');
    http
      .expectOne((r) => r.url === `${api}/health/programs/hp1/schedule`)
      .flush({
        program: PROGRAM,
        as_of: '2024-01-03',
        items: [NOTICE],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelectorAll('[data-notice-id]').length;
      })
      .toBe(1);
    expect(element(f).querySelector('button[aria-label^="Registrar aplicación"]')).toBeNull();
  });
  it('creates a program with the selected product and age and sex filters', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-testid=new-program]');
    http
      .expectOne((r) => r.url === `${api}/health/products`)
      .flush({ items: [PRODUCT], total: 1, offset: 0, limit: 100 });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#program-product')?.options.length;
      })
      .toBe(2);
    fill(f, 'program-name', '  Vacunación de hembras  ');
    fill(f, 'program-product', 'p1');
    fill(f, 'program-age', '30');
    fill(f, 'program-sex', 'female');
    element(f)
      .querySelector('dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/programs`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      name: 'Vacunación de hembras',
      product_id: 'p1',
      interval_days: 90,
      minimum_age_days: 30,
      sex: 'female',
      notice_days: 7,
      active: true,
    });
    req.flush({ ...PROGRAM, name: 'Vacunación de hembras', sex: 'female' });
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/health/programs`)
            .map((r) => {
              r.flush({ items: [PROGRAM], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return !element(f).querySelector('app-detail-page, dialog');
      })
      .toBe(true);
  });
  it('records an application and refreshes pending notices', async () => {
    await login();
    const f = await fixture();
    click(f, 'button[aria-label^="Ver avisos"]');
    http
      .expectOne((r) => r.url === `${api}/health/programs/hp1/schedule`)
      .flush({
        program: PROGRAM,
        as_of: '2024-01-03',
        items: [NOTICE],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('button[aria-label^="Registrar aplicación"]');
      })
      .toBe(true);
    click(f, 'button[aria-label^="Registrar aplicación"]');
    http.expectOne(`${api}/health/catalogs`).flush({
      product_types: [{ id: 1, name: 'vaccine' }],
      units: [{ id: 1, code: 'ml' }],
      routes: [{ id: 1, name: 'subcutaneous' }],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#application-unit')?.options.length;
      })
      .toBe(2);
    fill(f, 'application-dose', '1.25');
    fill(f, 'application-start', '2024-01-03');
    for (const id of ['application-unit', 'application-route']) {
      const el = element(f).querySelector<HTMLSelectElement>(`#${id}`)!;
      el.selectedIndex = 1;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    f.detectChanges();
    element(f)
      .querySelector('dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne(`${api}/health/programs/hp1/applications`);
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      start_date: '2024-01-03',
      dose_value: 1.25,
      dose_unit_id: 1,
      route_id: 1,
      frequency_hours: null,
      duration_days: 1,
    });
    req.flush({ id: 't1', program_id: 'hp1' });
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/health/programs/hp1/schedule`)
            .map((r) => {
              r.flush({
                program: PROGRAM,
                as_of: '2024-01-03',
                items: [],
                total: 0,
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
          ?.textContent?.includes('No hay animales para estos filtros');
      })
      .toBe(true);
  });
});
