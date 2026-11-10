import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../../app.routes';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { ANIMAL_PROVIDERS } from '../infrastructure/animal-repository';
import { BreedList } from './breed-list';
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
  permissions: ['animals:read', 'animals:write'],
};
const BREEDS = [
  { id: 1, name: 'Pelibuey' },
  { id: 2, name: 'Dorper' },
];
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<BreedList>): HTMLElement {
  return f.nativeElement;
}
function fill(f: ComponentFixture<BreedList>, id: string, value: string) {
  const input = element(f).querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  f.detectChanges();
}
function click(f: ComponentFixture<BreedList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function submit(f: ComponentFixture<BreedList>) {
  element(f)
    .querySelector('[data-testid="breed-form"]')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, 'Password8');
  http
    .expectOne(`${api}/auth/login`)
    .flush({
      expires_in: 1800,
      user: { ...USER, permissions },
    });
  await pending;
}
async function page() {
  const f = TestBed.createComponent(BreedList);
  f.detectChanges();
  const request = http.expectOne(`${api}/breeds`);
  expect(request.request.withCredentials).toBe(true);
  expect(request.request.headers.has('Authorization')).toBe(false);
  request.flush(BREEDS);
  await f.whenStable();
  f.detectChanges();
  return f;
}

describe('Breed catalog', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [BreedList],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        ...ANIMAL_PROVIDERS,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('lists and searches the catalog', async () => {
    await login();
    const f = await page();
    expect(element(f).querySelectorAll('[data-breed-id]').length).toBe(2);
    fill(f, 'breed-search', ' peli ');
    expect(element(f).querySelectorAll('[data-breed-id]').length).toBe(1);
    expect(element(f).textContent).toContain('Pelibuey');
  });
  it('creates and edits using the correct persisted breed ID', async () => {
    await login();
    const f = await page();
    click(f, '[data-testid="new-breed"]');
    fill(f, 'breed-name', ' Katahdin ');
    submit(f);
    const request = http.expectOne({ url: `${api}/breeds`, method: 'POST' });
    expect(request.request.body).toEqual({ name: 'Katahdin' });
    request.flush({ id: 3, name: 'Katahdin' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-modal')).toBeNull();
    click(f, '[data-breed-id="3"] button[aria-label^="Editar"]');
    expect(element(f).querySelector<HTMLInputElement>('#breed-name')?.value).toBe('Katahdin');
    fill(f, 'breed-name', 'Katahdin corregido');
    submit(f);
    const update = http.expectOne({ url: `${api}/breeds/3`, method: 'PUT' });
    expect(update.request.body).toEqual({ name: 'Katahdin corregido' });
    update.flush({ id: 3, name: 'Katahdin corregido' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('[data-breed-id="3"]')?.textContent).toContain(
      'Katahdin corregido',
    );
    expect(element(f).querySelectorAll('[data-breed-id]').length).toBe(3);
  });
  it('keeps the edit open with a translated duplicate error', async () => {
    await login();
    const f = await page();
    click(f, '[data-breed-id="1"] button[aria-label^="Editar"]');
    fill(f, 'breed-name', 'Dorper');
    submit(f);
    http
      .expectOne({ url: `${api}/breeds/1`, method: 'PUT' })
      .flush({ detail: 'Breed already exists' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-modal')?.textContent).toContain('Esa raza ya existe');
    expect(element(f).querySelector('[data-breed-id="1"]')?.textContent).toContain('Pelibuey');
  });
  it('requires confirmation and keeps assigned breeds on deletion conflict', async () => {
    await login();
    const f = await page();
    click(f, '[data-breed-id="1"] button[aria-label^="Eliminar"]');
    http.expectNone((r) => r.method === 'DELETE');
    click(f, '[data-testid="confirm-delete-breed"]');
    http
      .expectOne({ url: `${api}/breeds/1`, method: 'DELETE' })
      .flush({ detail: 'Breed is assigned to animals' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-modal')?.textContent).toContain(
      'La raza está asignada a animales',
    );
    expect(element(f).querySelector('[data-breed-id="1"]')).not.toBeNull();
    click(f, 'button[aria-label="Cerrar diálogo"]');
    click(f, '[data-breed-id="2"] button[aria-label^="Eliminar"]');
    click(f, '[data-testid="confirm-delete-breed"]');
    http
      .expectOne({ url: `${api}/breeds/2`, method: 'DELETE' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('[data-breed-id="2"]')).toBeNull();
    expect(element(f).querySelector('app-modal')).toBeNull();
  });
  it('shows only read actions for a read-only role', async () => {
    await login(['animals:read']);
    const f = await page();
    expect(element(f).querySelector('[data-testid="new-breed"]')).toBeNull();
    expect(element(f).querySelector('tbody button')).toBeNull();
    expect(element(f).textContent).toContain('Solo consulta');
  });
  it('does not load the catalog without permission', async () => {
    await login([]);
    const f = TestBed.createComponent(BreedList);
    f.detectChanges();
    http.expectNone(`${api}/breeds`);
    expect(element(f).textContent).toContain('No tienes permiso');
  });
});
