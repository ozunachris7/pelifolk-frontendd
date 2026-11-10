import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../../app.routes';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { ANIMAL_PROVIDERS } from '../infrastructure/animal-repository';
import { Animal } from '../domain/animal';
import { AnimalList } from './animal-list';

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
const ANIMAL: Animal = {
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Luna',
  siniiga: 'MX123',
  sex: 'female',
  birth_date: '2024-01-01',
  origin: 'born_in_herd',
  mother_id: null,
  father_id: null,
  is_breeder: false,
  breeds: [{ breed_id: 1, name: 'Pelibuey', percentage: '100.00' }],
  created_at: '2024-01-01T00:00:00',
  mother: null,
  father: null,
  purity: 'pure',
};
let http: HttpTestingController;
let api: string;
function element(f: ComponentFixture<AnimalList>): HTMLElement {
  return f.nativeElement;
}
function fill(f: ComponentFixture<AnimalList>, id: string, value: string) {
  const input = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(
    new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
  );
  f.detectChanges();
}
function click(f: ComponentFixture<AnimalList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function submit(f: ComponentFixture<AnimalList>) {
  element(f)
    .querySelector('[data-testid="animal-form"]')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, 'Valid-password8');
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await pending;
}
async function page() {
  const fixture = TestBed.createComponent(AnimalList);
  fixture.detectChanges();
  const request = http.expectOne((req) => req.url === `${api}/animals`);
  expect(request.request.withCredentials).toBe(true);
  expect(request.request.headers.has('Authorization')).toBe(false);
  request.flush({ items: [ANIMAL], total: 1, offset: 0, limit: 25 });
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}
async function openForm(f: ComponentFixture<AnimalList>, selector = '[data-testid="new-animal"]') {
  click(f, selector);
  http.expectOne(`${api}/breeds`).flush([
    { id: 1, name: 'Pelibuey' },
    { id: 2, name: 'Dorper' },
  ]);
  const parents = http.match((req) => req.url === `${api}/animals`);
  expect(parents.length).toBe(2);
  for (const request of parents) {
    expect(request.request.params.get('limit')).toBe('100');
    expect(request.request.params.get('parent_of')).toBe(
      selector.includes('Editar') ? ANIMAL.id : null,
    );
    request.flush({ items: [], total: 0, offset: 0, limit: 100 });
  }
  await f.whenStable();
  f.detectChanges();
}

describe('Animal management', () => {
  it('filters active animals and displays exited animals with their status', async () => {
    await login();
    const f = await page();
    fill(f, 'animal-filter-active', 'false');
    element(f)
      .querySelector('form[aria-label="Buscar animales"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
    const req = http.expectOne((r) => r.url === `${api}/animals`);
    expect(req.request.params.get('active')).toBe('false');
    req.flush({
      items: [{ ...ANIMAL, status: 'sale', exit_date: '2024-06-01' }],
      total: 1,
      offset: 0,
      limit: 25,
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[data-animal-status=sale]')?.textContent;
      })
      .toContain('Venta');
  });

  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [AnimalList],
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
  it('searches across all animals with server pagination and sex filter', async () => {
    await login();
    const f = await page();
    fill(f, 'animal-search', 'MX123');
    fill(f, 'animal-filter-sex', 'female');
    element(f)
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const req = http.expectOne((r) => r.url === `${api}/animals`);
    expect(req.request.params.get('q')).toBe('MX123');
    expect(req.request.params.get('sex')).toBe('female');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ items: [], total: 0, offset: 0, limit: 25 });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).textContent).toContain('No hay animales con esa búsqueda.');
  });
  it('creates an animal with unknown breeds and parents, then refreshes the list', async () => {
    await login();
    const f = await page();
    await openForm(f);
    expect(element(f).querySelector('#animal-breed-0')).not.toBeNull();
    expect(element(f).querySelector<HTMLInputElement>('#animal-percentage-0')!.value).toBe('100');
    click(f, 'button[aria-label="Quitar raza 1"]');
    fill(f, 'animal-name', 'Nube');
    fill(f, 'animal-siniiga', 'MX999');
    submit(f);
    const req = http.expectOne({ url: `${api}/animals`, method: 'POST' });
    expect(req.request.body).toEqual({
      name: 'Nube',
      siniiga: 'MX999',
      sex: 'female',
      birth_date: null,
      origin: 'born_in_herd',
      mother_id: null,
      father_id: null,
      is_breeder: false,
      breeds: [],
    });
    req.flush({ ...ANIMAL, name: 'Nube', siniiga: 'MX999' });
    await vi.waitFor(() => {
      http
        .expectOne((r) => r.url === `${api}/animals` && r.method === 'GET')
        .flush({ items: [ANIMAL], total: 1, offset: 0, limit: 25 });
    });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-detail-page, app-modal')).toBeNull();
    expect(element(f).textContent).toContain('Animal registrado.');
  });
  it('prevents invalid breed totals and saves a valid edit preserving parent fields', async () => {
    await login();
    const f = await page();
    await openForm(f, 'button[aria-label^="Editar animal"]');
    fill(f, 'animal-percentage-0', '90');
    submit(f);
    http.expectNone((r) => r.method === 'PUT');
    expect(element(f).textContent).toContain('deben sumar 100');
    fill(f, 'animal-percentage-0', '100');
    fill(f, 'animal-name', 'Luna nueva');
    submit(f);
    const req = http.expectOne({ url: `${api}/animals/${ANIMAL.id}`, method: 'PUT' });
    expect(req.request.body.breeds).toEqual([{ breed_id: 1, percentage: 100 }]);
    expect(req.request.body.mother_id).toBeNull();
    req.flush({ ...ANIMAL, name: 'Luna nueva' });
    await vi.waitFor(() => {
      http
        .expectOne((r) => r.url === `${api}/animals`)
        .flush({ items: [{ ...ANIMAL, name: 'Luna nueva' }], total: 1, offset: 0, limit: 25 });
    });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).textContent).toContain('Luna nueva');
  });
  it('registers a missing breed and adds it to the animal form', async () => {
    await login();
    const f = await page();
    await openForm(f);
    fill(f, 'new-breed', 'Katahdin');
    click(f, '#new-breed + button');
    const req = http.expectOne({ url: `${api}/breeds`, method: 'POST' });
    expect(req.request.body).toEqual({ name: 'Katahdin' });
    req.flush({ id: 3, name: 'Katahdin' });
    await f.whenStable();
    f.detectChanges();
    expect(
      element(f).querySelector<HTMLSelectElement>('#animal-breed-0')?.selectedOptions[0]
        .textContent,
    ).toBe('Katahdin');
    expect(element(f).querySelector<HTMLInputElement>('#animal-percentage-0')?.value).toBe('100');
  });
  it('uses the edited animal for parent options and removes a cached descendant selection', async () => {
    await login();
    const f = await page();
    click(f, 'button[aria-label^="Editar animal"]');
    http.expectOne(`${api}/breeds`).flush([{ id: 1, name: 'Pelibuey' }]);
    const requests = http.match((r) => r.url === `${api}/animals`);
    const descendant = { ...ANIMAL, id: 'aurora', name: 'Aurora', breeds: [] };
    for (const r of requests) {
      expect(r.request.params.get('parent_of')).toBe(ANIMAL.id);
      r.flush({
        items: r.request.params.get('sex') === 'female' ? [descendant] : [],
        total: 1,
        offset: 0,
        limit: 100,
        excluded_parent_ids: [ANIMAL.id],
      });
    }
    await f.whenStable();
    f.detectChanges();
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLOptionElement>('#animal-mother option[value=aurora]');
      })
      .toBeTruthy();
    fill(f, 'animal-mother', 'aurora');
    const searchButton = [...element(f).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Buscar padres'),
    )!;
    searchButton.click();
    f.detectChanges();
    for (const r of http.match((r) => r.url === `${api}/animals`)) {
      r.flush({
        items: [],
        total: 0,
        offset: 0,
        limit: 100,
        excluded_parent_ids: [ANIMAL.id, 'aurora'],
      });
    }
    await f.whenStable();
    f.detectChanges();
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#animal-mother')?.value;
      })
      .toBe('');
    const mothers = element(f).querySelector<HTMLSelectElement>('#animal-mother')!;
    expect(mothers.value).toBe('');
    expect([...mothers.options].some((o) => o.value === 'aurora')).toBe(false);
  });
  it('shows server detail and hides mutations for read-only users', async () => {
    await login(['animals:read']);
    const f = await page();
    expect(element(f).querySelector('[data-testid="new-animal"]')).toBeNull();
    expect(element(f).querySelector('button[aria-label^="Editar animal"]')).toBeNull();
    click(f, 'button[aria-label^="Ver ficha"]');
    http.expectOne(`${api}/animals/${ANIMAL.id}`).flush(ANIMAL);
    await f.whenStable();
    f.detectChanges();
    http
      .expectOne((r) => r.url === `${api}/animals/${ANIMAL.id}/decisions`)
      .flush({ items: [], total: 0, offset: 0, limit: 25 });
    expect(element(f).querySelector('app-detail-page, app-modal')?.textContent).toContain(
      'Pelibuey',
    );
  });
  it('does not request protected data without read permission', async () => {
    await login([]);
    const f = TestBed.createComponent(AnimalList);
    f.detectChanges();
    http.expectNone((r) => r.url === `${api}/animals`);
    expect(element(f).textContent).toContain('No tienes permiso');
  });
  it('keeps the form open and translates duplicate SINIIGA errors', async () => {
    await login();
    const f = await page();
    await openForm(f);
    fill(f, 'animal-name', 'Luna');
    const breedSelect = element(f).querySelector<HTMLSelectElement>('#animal-breed-0')!;
    fill(f, 'animal-breed-0', breedSelect.options[1].value);
    submit(f);
    http
      .expectOne({ url: `${api}/animals`, method: 'POST' })
      .flush({ detail: 'SINIIGA already exists' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-detail-page, app-modal')?.textContent).toContain(
      'Ya existe un animal con ese SINIIGA.',
    );
    expect(
      element(f).querySelector<HTMLButtonElement>(
        '[data-testid="animal-form"] button[type="submit"]',
      )?.disabled,
    ).toBe(false);
  });
});
