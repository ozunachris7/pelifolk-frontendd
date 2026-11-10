import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { routes } from '../../../app.routes';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { ORGANIZATION_PROVIDERS } from '../infrastructure/organization-repository';
import { Group, Membership } from '../domain/organization';
import { GroupList } from './group-list';
import { GroupDetail } from './group-detail';
import { LocationList } from './location-list';
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
  permissions: ['locations:read', 'locations:write', 'groups:read', 'groups:write'],
};
const GROUP: Group = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'Crías',
  description: null,
  active: true,
  member_count: 1,
};
const TARGET: Group = {
  ...GROUP,
  id: '40000000-0000-4000-8000-000000000002',
  name: 'Reproductoras',
  member_count: 0,
};
const MEMBER: Membership = {
  group_id: GROUP.id,
  group_name: GROUP.name,
  animal_id: '30000000-0000-4000-8000-000000000001',
  animal_name: 'Luna',
  siniiga: 'MX123',
  start_date: '2024-01-01',
  end_date: null,
};
const LOCATION = {
  id: '50000000-0000-4000-8000-000000000001',
  name: 'Corral norte',
  description: null,
  active: true,
  location_type_id: 1,
  location_type_name: 'corral',
};
let http: HttpTestingController, api: string;
function element<T>(f: ComponentFixture<T>): HTMLElement {
  return f.nativeElement;
}
function fill<T>(f: ComponentFixture<T>, id: string, value: string) {
  const input = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(
    new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
  );
  f.detectChanges();
}
function click<T>(f: ComponentFixture<T>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function submit<T>(f: ComponentFixture<T>, testid: string) {
  element(f)
    .querySelector(`[data-testid="${testid}"]`)!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, 'Password8');
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await pending;
}
async function detailResponse(f: ComponentFixture<GroupDetail>, members: Membership[] = [MEMBER]) {
  http
    .expectOne(`${api}/groups/${GROUP.id}`)
    .flush({ ...GROUP, member_count: members.filter((m) => !m.end_date).length });
  const req = http.expectOne((r) => r.url === `${api}/groups/${GROUP.id}/memberships`);
  expect(req.request.withCredentials).toBe(true);
  expect(req.request.headers.has('Authorization')).toBe(false);
  req.flush({ items: members, total: members.length, offset: 0, limit: 25 });
  await expect
    .poll(() => {
      f.detectChanges();
      return (
        !element(f).textContent?.includes('Cargando animales del lote') &&
        element(f).querySelectorAll('[data-member-id]').length === members.length
      );
    })
    .toBe(true);
}
async function detail() {
  const f = TestBed.createComponent(GroupDetail);
  f.detectChanges();
  await detailResponse(f);
  return f;
}

describe('Organization management', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [LocationList, GroupList, GroupDetail],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        ...ORGANIZATION_PROVIDERS,
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: TestBed.inject(Router).routerState.snapshot.root,
            paramMap: of(convertToParamMap({ id: GROUP.id })),
          }),
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('adds a location type and creates a location with the selected type', async () => {
    await login();
    const f = TestBed.createComponent(LocationList);
    f.detectChanges();
    http.expectOne(`${api}/locations`).flush([]);
    await f.whenStable();
    f.detectChanges();
    click(f, '[data-testid="new-location"]');
    http.expectOne(`${api}/location-types`).flush([{ id: 1, name: 'corral' }]);
    await f.whenStable();
    f.detectChanges();
    fill(f, 'new-location-type', 'Potrero especial');
    click(f, '#new-location-type + button');
    http
      .expectOne({ url: `${api}/location-types`, method: 'POST' })
      .flush({ id: 2, name: 'Potrero especial' });
    await f.whenStable();
    f.detectChanges();
    fill(f, 'location-name', 'Potrero norte');
    submit(f, 'location-form');
    const req = http.expectOne({ url: `${api}/locations`, method: 'POST' });
    expect(req.request.body).toEqual({
      name: 'Potrero norte',
      description: null,
      location_type_id: 2,
      active: true,
    });
    req.flush({
      ...LOCATION,
      name: 'Potrero norte',
      location_type_id: 2,
      location_type_name: 'Potrero especial',
    });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).textContent).toContain('Potrero norte');
    expect(element(f).querySelector('app-modal')).toBeNull();
  });
  it('edits a location and retains inactive records under the status filter', async () => {
    await login();
    const f = TestBed.createComponent(LocationList);
    f.detectChanges();
    http.expectOne(`${api}/locations`).flush([LOCATION]);
    await f.whenStable();
    f.detectChanges();
    click(f, 'button[aria-label^="Editar ubicación"]');
    http.expectOne(`${api}/location-types`).flush([{ id: 1, name: 'corral' }]);
    await f.whenStable();
    f.detectChanges();
    fill(f, 'location-name', 'Corral principal');
    click(f, 'input[formControlName="active"]');
    submit(f, 'location-form');
    const req = http.expectOne({ url: `${api}/locations/${LOCATION.id}`, method: 'PUT' });
    expect(req.request.body.active).toBe(false);
    req.flush({ ...LOCATION, name: 'Corral principal', active: false });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('[data-location-id]')).toBeNull();
    fill(f, 'location-status', 'inactive');
    expect(element(f).querySelector('[data-location-id]')?.textContent).toContain(
      'Corral principal',
    );
  });
  it('creates a group with a link to its member view', async () => {
    await login();
    const f = TestBed.createComponent(GroupList);
    f.detectChanges();
    http.expectOne(`${api}/groups`).flush([]);
    await f.whenStable();
    f.detectChanges();
    click(f, '[data-testid="new-group"]');
    fill(f, 'group-name', 'Crías');
    submit(f, 'group-form');
    const req = http.expectOne({ url: `${api}/groups`, method: 'POST' });
    expect(req.request.body).toEqual({ name: 'Crías', description: null, active: true });
    req.flush({ ...GROUP, member_count: 0 });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('a[href="/dashboard/groups/' + GROUP.id + '"]')).not.toBeNull();
  });
  it('keeps the group edit open when assigned animals prevent deactivation', async () => {
    await login();
    const f = TestBed.createComponent(GroupList);
    f.detectChanges();
    http.expectOne(`${api}/groups`).flush([GROUP]);
    await f.whenStable();
    f.detectChanges();
    click(f, 'button[aria-label^="Editar lote"]');
    click(f, 'input[formControlName="active"]');
    submit(f, 'group-form');
    http
      .expectOne({ url: `${api}/groups/${GROUP.id}`, method: 'PUT' })
      .flush({ detail: 'Group has assigned animals' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('app-modal')?.textContent).toContain('Mueve o retira');
    expect(element(f).querySelector('[data-group-id]')).not.toBeNull();
  });
  it('assigns a selected animal and explicitly confirms moving it from another group', async () => {
    await login();
    const f = await detail();
    click(f, '[data-testid="assign-animals"]');
    http
      .expectOne((r) => r.url === `${api}/groups/animal-options`)
      .flush({
        items: [
          {
            id: '30000000-0000-4000-8000-000000000002',
            name: 'Nube',
            siniiga: 'MX456',
            group_id: TARGET.id,
            group_name: TARGET.name,
          },
        ],
        total: 1,
      });
    await f.whenStable();
    f.detectChanges();
    click(f, 'input[data-option-id]');
    fill(f, 'movement-date', '2024-03-01');
    submit(f, 'movement-form');
    const conflict = http.expectOne({
      url: `${api}/groups/${GROUP.id}/assignments`,
      method: 'POST',
    });
    expect(conflict.request.body.move_existing).toBe(false);
    conflict.flush(
      { detail: 'Animal already belongs to another group' },
      { status: 409, statusText: 'Conflict' },
    );
    await f.whenStable();
    f.detectChanges();
    expect(element(f).textContent).toContain('Activa la opción de moverlos');
    click(f, 'input[formControlName="move_existing"]');
    submit(f, 'movement-form');
    const req = http.expectOne({ url: `${api}/groups/${GROUP.id}/assignments`, method: 'POST' });
    expect(req.request.body).toEqual({
      animal_ids: ['30000000-0000-4000-8000-000000000002'],
      effective_date: '2024-03-01',
      move_existing: true,
    });
    req.flush([{ ...MEMBER, animal_name: 'Nube' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await detailResponse(f, [
      MEMBER,
      { ...MEMBER, animal_id: '30000000-0000-4000-8000-000000000002', animal_name: 'Nube' },
    ]);
    expect(element(f).querySelector('app-modal')).toBeNull();
    expect(element(f).querySelectorAll('[data-member-id]').length).toBe(2);
  });
  it('moves an animal to an active destination and refreshes current membership', async () => {
    await login();
    const f = await detail();
    click(f, 'button[aria-label^="Mover animal"]');
    http
      .expectOne(`${api}/groups`)
      .flush([GROUP, TARGET, { ...TARGET, id: 'inactive', active: false }]);
    await f.whenStable();
    f.detectChanges();
    expect(element(f).querySelector('#target-group')?.textContent).not.toContain('Crías');
    fill(f, 'target-group', TARGET.id);
    fill(f, 'movement-date', '2024-02-01');
    submit(f, 'movement-form');
    const req = http.expectOne({ url: `${api}/groups/${TARGET.id}/assignments`, method: 'POST' });
    expect(req.request.body).toEqual({
      animal_ids: [MEMBER.animal_id],
      effective_date: '2024-02-01',
      move_existing: true,
    });
    req.flush([{ ...MEMBER, group_id: TARGET.id, group_name: TARGET.name }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await detailResponse(f, []);
    expect(element(f).textContent).toContain('Animal trasladado');
    expect(element(f).querySelector('[data-member-id]')).toBeNull();
  });
  it('requires confirmation to remove an animal and shows its closed period in history', async () => {
    await login();
    const f = await detail();
    click(f, 'button[aria-label^="Retirar animal"]');
    http.expectNone((r) => r.url.endsWith('/remove'));
    fill(f, 'movement-date', '2024-03-01');
    submit(f, 'movement-form');
    const req = http.expectOne({
      url: `${api}/groups/${GROUP.id}/animals/${MEMBER.animal_id}/remove`,
      method: 'POST',
    });
    expect(req.request.body).toEqual({ effective_date: '2024-03-01' });
    req.flush({ ...MEMBER, end_date: '2024-02-29' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await detailResponse(f, []);
    click(f, '[data-testid="group-history"]');
    http.expectOne(`${api}/groups/${GROUP.id}`).flush({ ...GROUP, member_count: 0 });
    const history = http.expectOne((r) => r.url === `${api}/groups/${GROUP.id}/memberships`);
    expect(history.request.params.get('current')).toBe('false');
    history.flush({
      items: [{ ...MEMBER, end_date: '2024-02-29' }],
      total: 1,
      offset: 0,
      limit: 25,
    });
    await f.whenStable();
    f.detectChanges();
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('29/02/2024');
    expect(element(f).querySelector('button[aria-label^="Retirar animal"]')).toBeNull();
  });
  it('does not offer movement actions to a read-only role', async () => {
    await login(['groups:read']);
    const f = await detail();
    expect(element(f).querySelector('[data-testid="assign-animals"]')).toBeNull();
    expect(element(f).querySelector('button[aria-label^="Mover animal"]')).toBeNull();
    expect(element(f).textContent).toContain('Luna');
  });
  it('does not request protected catalogs without permissions', async () => {
    await login([]);
    const locations = TestBed.createComponent(LocationList),
      groups = TestBed.createComponent(GroupList);
    locations.detectChanges();
    groups.detectChanges();
    http.expectNone(`${api}/locations`);
    http.expectNone(`${api}/groups`);
    expect(element(locations).textContent).toContain('No tienes permiso');
    expect(element(groups).textContent).toContain('No tienes permiso');
  });
});
