import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { BreedingRepository } from '../infrastructure/breeding-repository';
import { BreedingList } from './breeding-list';
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
  permissions: ['breeding:read', 'breeding:write'],
};
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<BreedingList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<BreedingList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<BreedingList>, id: string, value: string) {
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

const FEMALE = { id: 'f1', name: 'Luna', siniiga: 'MX1', sex: 'female' };
const MALE = { id: 'm1', name: 'Trueno', siniiga: 'MX2', sex: 'male' };
async function fixture() {
  const f = TestBed.createComponent(BreedingList);
  f.detectChanges();
  http
    .expectOne((r) => r.url === `${api}/breeding/events`)
    .flush({ items: [], total: 0, offset: 0, limit: 25 });
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).textContent;
    })
    .toContain('No hay registros');
  return f;
}
async function open(f: ComponentFixture<BreedingList>) {
  click(f, '[data-testid=new-breeding]');
  http
    .expectOne(
      (r) => r.url === `${api}/breeding/animal-options` && r.params.get('sex') === 'female',
    )
    .flush([FEMALE]);
  http
    .expectOne((r) => r.url === `${api}/breeding/animal-options` && r.params.get('sex') === 'male')
    .flush([MALE]);
  http.expectOne(`${api}/breeding/birth-types`).flush([{ id: 1, name: 'natural' }]);
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).querySelector<HTMLSelectElement>('#breeding-female')?.options.length;
    })
    .toBe(2);
}
function submit(f: ComponentFixture<BreedingList>) {
  element(f)
    .querySelector('dialog form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
describe('Reproduction', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [BreedingList],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        BreedingRepository,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('respects read and write permissions', async () => {
    await login([]);
    const denied = TestBed.createComponent(BreedingList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes('/breeding/'));
    expect(element(denied).textContent).toContain('No tienes permiso');
    denied.destroy();
    await login(['breeding:read']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-breeding]')).toBeNull();
  });
  it('posts a mating without requiring offspring and keeps input on API failure', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'breeding-female', 'f1');
    fill(f, 'breeding-male', 'm1');
    fill(f, 'breeding-date', '2024-01-01');
    http
      .expectOne((r) => r.url.endsWith('/breeding/kinship'))
      .flush({
        female: FEMALE,
        male: MALE,
        depth: 2,
        status: 'insufficient_data',
        lineage_complete: false,
        invalid_lineage: false,
        missing_female: ['mother'],
        missing_male: ['father'],
        matches: [],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('Datos genealógicos incompletos');
    submit(f);
    const req = http.expectOne(`${api}/breeding/matings`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      animal_id: 'f1',
      male_id: 'm1',
      date: '2024-01-01',
      notes: null,
    });
    req.flush(
      { detail: 'Animal has exited the herd' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[role=alert]')?.textContent;
      })
      .toBeTruthy();
    expect(element(f).querySelector<HTMLInputElement>('#breeding-female')?.value).toBe('f1');
  });
  it('shows a shared parent and requires a successful check before saving', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'breeding-female', 'f1');
    fill(f, 'breeding-male', 'm1');
    const request = http.expectOne((r) => r.url.endsWith('/breeding/kinship'));
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('El servicio no está disponible');
    submit(f);
    http.expectNone((r) => r.url.endsWith('/breeding/matings'));
    [...element(f).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    http
      .expectOne((r) => r.url.endsWith('/breeding/kinship'))
      .flush({
        female: FEMALE,
        male: MALE,
        depth: 2,
        status: 'related',
        lineage_complete: false,
        invalid_lineage: false,
        missing_female: ['father'],
        missing_male: ['father'],
        matches: [
          {
            kind: 'shared_parent',
            ancestor: { id: 'a1', name: 'Aurora', siniiga: 'MX3', sex: 'female' },
            female_paths: ['mother'],
            male_paths: ['mother'],
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('Progenitor compartido · Aurora');
    expect(element(f).textContent).toContain('Faltan datos de padres o abuelos');
  });
  it('ignores an old relationship check after changing the selected pair', async () => {
    await login();
    const f = await fixture();
    await open(f);
    fill(f, 'breeding-female', 'f1');
    fill(f, 'breeding-male', 'm1');
    const older = http.expectOne((r) => r.url.endsWith('/breeding/kinship'));
    fill(f, 'breeding-male', '');
    fill(f, 'breeding-male', 'm1');
    const latest = http.expectOne((r) => r.url.endsWith('/breeding/kinship'));
    latest.flush({
      female: FEMALE,
      male: MALE,
      depth: 2,
      status: 'insufficient_data',
      lineage_complete: false,
      invalid_lineage: false,
      missing_female: ['mother'],
      missing_male: ['father'],
      matches: [],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('Datos genealógicos incompletos');
    older.flush({
      female: FEMALE,
      male: MALE,
      depth: 2,
      status: 'related',
      lineage_complete: true,
      invalid_lineage: false,
      missing_female: [],
      missing_male: [],
      matches: [],
    });
    await Promise.resolve();
    f.detectChanges();
    expect(element(f).textContent).not.toContain('Parentesco registrado entre estos animales');
  });
  it('registers two offspring together with optional father and birth weights', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-kind=birth]');
    http
      .expectOne((r) => r.url === `${api}/breeding/events`)
      .flush({ items: [], total: 0, offset: 0, limit: 25 });
    await open(f);
    fill(f, 'breeding-female', 'f1');
    fill(f, 'breeding-male', 'm1');
    fill(f, 'breeding-date', '2024-06-01');
    const select = element(f).querySelector<HTMLSelectElement>('#birth-type')!;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    fill(f, 'offspring-name-0', ' Estrella ');
    fill(f, 'offspring-sex-0', 'female');
    fill(f, 'offspring-weight-0', '3.25');
    click(f, '[data-testid=add-offspring]');
    fill(f, 'offspring-tag-1', 'MX3');
    fill(f, 'offspring-sex-1', 'male');
    submit(f);
    const req = http.expectOne(`${api}/breeding/births`);
    expect(req.request.body).toEqual({
      animal_id: 'f1',
      father_id: 'm1',
      date: '2024-06-01',
      notes: null,
      birth_type_id: 1,
      offspring: [
        { name: 'Estrella', siniiga: null, sex: 'female', alive: true, birth_weight_kg: 3.25 },
        { name: null, siniiga: 'MX3', sex: 'male', alive: true, birth_weight_kg: null },
      ],
    });
    const saved = {
      id: 'b1',
      kind: 'birth',
      animal: FEMALE,
      date: '2024-06-01',
      notes: null,
      recorded_by: 'Cris',
      birth_type: 'natural',
      offspring: [
        {
          animal: { id: 'c1', name: 'Estrella', siniiga: null, sex: 'female' },
          alive: true,
          birth_weight_kg: 3.25,
        },
        {
          animal: { id: 'c2', name: null, siniiga: 'MX3', sex: 'male' },
          alive: true,
          birth_weight_kg: null,
        },
      ],
    };
    req.flush(saved);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/breeding/events`)
            .map((r) => {
              r.flush({ items: [saved], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('Crías registradas');
  });
});
