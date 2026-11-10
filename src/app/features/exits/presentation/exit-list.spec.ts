import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { ExitRepository } from '../infrastructure/exit-repository';
import { ExitList } from './exit-list';
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
  permissions: ['exits:read', 'exits:write'],
};
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<ExitList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<ExitList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<ExitList>, id: string, value: string) {
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

const ANIMAL = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const RECORD = {
  id: 'e1',
  animal: ANIMAL,
  exit_type: 'sale',
  date: '2024-06-01',
  reason: 'Venta a otro rancho.',
  recorded_by: 'Cris',
};
async function fixture() {
  const f = TestBed.createComponent(ExitList);
  f.detectChanges();
  http
    .expectOne((r) => r.url === `${api}/exits`)
    .flush({ items: [], total: 0, offset: 0, limit: 25 });
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).textContent;
    })
    .toContain('No hay salidas');
  return f;
}
async function open(f: ComponentFixture<ExitList>) {
  click(f, '[data-testid=new-exit]');
  http.expectOne((r) => r.url === `${api}/exits/animal-options`).flush([ANIMAL]);
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).querySelector<HTMLSelectElement>('#exit-animal')?.options.length;
    })
    .toBe(2);
}
async function flushWithdrawal(f: ComponentFixture<ExitList>, status = 'complete') {
  const requests = http.match((r) => r.url.includes('/withdrawal'));
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests)
    request.flush({
      animal: ANIMAL,
      status,
      as_of: request.request.params.get('date'),
      release_date: status === 'pending' ? '2024-06-08' : '2024-01-01',
      treatment_count: 1,
      unknown_count: 0,
      in_treatment: false,
    });
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).textContent;
    })
    .toContain(status === 'pending' ? 'Retiro pendiente' : 'Sin retiro pendiente según registros');
}
function submit(f: ComponentFixture<ExitList>) {
  element(f)
    .querySelector('dialog form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
describe('Herd exits', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [ExitList],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        ExitRepository,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('does not request data without read access and hides registration for readers', async () => {
    await login([]);
    const denied = TestBed.createComponent(ExitList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes('/exits'));
    expect(element(denied).textContent).toContain('No tienes permiso');
    denied.destroy();
    await login(['exits:read']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-exit]')).toBeNull();
  });
  it('registers an exit and displays its saved details', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'exit-animal', 'a1');
    fill(f, 'exit-date', '2024-06-01');
    await flushWithdrawal(f, 'pending');
    fill(f, 'exit-reason', ' Venta a otro rancho. ');
    submit(f);
    const req = http.expectOne(`${api}/exits`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      exit_type: 'sale',
      date: '2024-06-01',
      reason: 'Venta a otro rancho.',
    });
    req.flush(RECORD);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/exits`)
            .map((r) => {
              r.flush({ items: [RECORD], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('dialog')?.textContent;
      })
      .toContain('Venta a otro rancho.');
  });
  it('ignores stale withdrawal replies and requires a successful consultation', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'exit-animal', 'a1');
    const first = http.expectOne((r) => r.url.includes('/withdrawal'));
    fill(f, 'exit-date', '2024-06-01');
    const latest = http.expectOne((r) => r.url.includes('/withdrawal'));
    latest.flush({ animal: ANIMAL, status: 'unknown', release_date: null, unknown_count: 1 });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('Periodo por verificar');
    first.flush({ animal: ANIMAL, status: 'complete', release_date: '2024-01-01' });
    await Promise.resolve();
    f.detectChanges();
    expect(element(f).textContent).not.toContain('Sin retiro pendiente según registros');
    fill(f, 'exit-date', '2024-06-02');
    http
      .expectOne((r) => r.url.includes('/withdrawal'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('No se puede determinar');
    fill(f, 'exit-reason', 'Venta');
    submit(f);
    http.expectNone((r) => r.method === 'POST');
  });
  it('preserves the form when another person has already registered an exit', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'exit-animal', 'a1');
    await flushWithdrawal(f);
    fill(f, 'exit-reason', 'Salida por venta');
    submit(f);
    http
      .expectOne(`${api}/exits`)
      .flush({ detail: 'Animal already has an exit' }, { status: 409, statusText: 'Conflict' });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[role=alert]')?.textContent;
      })
      .toContain('ya tiene una salida');
    expect(element(f).querySelector<HTMLSelectElement>('#exit-animal')?.value).toBe('a1');
  });
});
