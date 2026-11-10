import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../../app.routes';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { ACCESS_PROVIDERS } from '../infrastructure/access-repository';
import { Role, User } from '../domain/access';
import { UserList } from './pages/user-list/user-list';
import { RoleList } from './pages/role-list/role-list';

const PERMISSIONS = ['roles:read', 'roles:write', 'users:read', 'users:write'];
const OWNER_ROLE: Role = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'owner',
  is_system: true,
  permissions: PERMISSIONS,
};
const WORKER_ROLE: Role = {
  id: '00000000-0000-4000-8000-000000000004',
  name: 'worker',
  is_system: true,
  permissions: [],
};
const CUSTOM_ROLE: Role = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'supervisor',
  is_system: false,
  permissions: ['users:read'],
};
const OWNER: User = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Cris',
  middle_name: null,
  paternal_lastname: 'Ozuna',
  maternal_lastname: 'Vazquez',
  email: 'cris@example.com',
  phone: null,
  active: true,
  role_id: OWNER_ROLE.id,
  role_name: 'owner',
  permissions: PERMISSIONS,
};
const WORKER: User = {
  ...OWNER,
  id: '20000000-0000-4000-8000-000000000002',
  name: 'Ana',
  email: 'ana@example.com',
  role_id: WORKER_ROLE.id,
  role_name: 'worker',
  permissions: [],
};
const ROLES = [OWNER_ROLE, WORKER_ROLE, CUSTOM_ROLE];

function element<T>(fixture: ComponentFixture<T>): HTMLElement {
  return fixture.nativeElement;
}
function fill<T>(fixture: ComponentFixture<T>, id: string, value: string): void {
  const input = element(fixture).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(
    new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
  );
}
function click<T>(fixture: ComponentFixture<T>, selector: string): void {
  const button = element(fixture).querySelector<HTMLButtonElement>(selector)!;
  expect(button).toBeTruthy();
  button.click();
  fixture.detectChanges();
}
function submit<T>(fixture: ComponentFixture<T>): void {
  element(fixture)
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}

let http: HttpTestingController;
let api: string;

async function signIn(user: SessionUser = OWNER): Promise<void> {
  const login = TestBed.inject(Session).login(user.email, 'Valid-password123');
  http
    .expectOne(`${api}/auth/login`)
    .flush({ expires_in: 1800, user });
  await login;
}
async function flushUsers(users: User[] = [OWNER, WORKER], roles: Role[] = ROLES): Promise<void> {
  await vi.waitFor(() => {
    const request = http.expectOne((req) => req.url === `${api}/users` && req.method === 'GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.params.get('limit')).toBe('25');
    request.flush(users);
    http.expectOne(`${api}/roles`).flush(roles);
  });
}
async function flushRoles(roles: Role[] = ROLES): Promise<void> {
  await vi.waitFor(() => {
    http.expectOne(`${api}/roles`).flush(roles);
    http.expectOne(`${api}/roles/permissions`).flush(PERMISSIONS);
  });
}
async function usersPage(): Promise<ComponentFixture<UserList>> {
  const fixture = TestBed.createComponent(UserList);
  fixture.detectChanges();
  await flushUsers();
  await expect
    .poll(() => {
      fixture.detectChanges();
      return element(fixture).querySelectorAll('tbody tr').length;
    })
    .toBe(1);
  return fixture;
}
async function rolesPage(): Promise<ComponentFixture<RoleList>> {
  const fixture = TestBed.createComponent(RoleList);
  fixture.detectChanges();
  await flushRoles();
  await expect
    .poll(() => {
      fixture.detectChanges();
      return element(fixture).querySelectorAll('[data-role-id]').length;
    })
    .toBe(3);
  return fixture;
}
function choosePermission<T>(
  fixture: ComponentFixture<T>,
  permission: string,
  checked: boolean,
): void {
  const input = element(fixture).querySelector<HTMLInputElement>(
    `input[data-permission="${permission}"]`,
  )!;
  input.checked = checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Users and roles administration', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [UserList, RoleList],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        ...ACCESS_PROVIDERS,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });

  it('creates a user with separate names, an assigned role and an eight-character password', async () => {
    await signIn();
    const fixture = await usersPage();
    click(fixture, '[data-testid="new-user"]');
    for (const [id, value] of [
      ['name', ' Juan '],
      ['middle_name', ' Carlos '],
      ['paternal_lastname', 'Lopez'],
      ['maternal_lastname', 'Perez'],
      ['email', 'juan@example.com'],
      ['phone', '9612345678'],
    ])
      fill(fixture, `user-${id}`, value);
    fill(fixture, 'user-role', CUSTOM_ROLE.id);
    fill(fixture, 'user-password', '12345678');
    submit(fixture);
    const request = http.expectOne({ url: `${api}/users`, method: 'POST' });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toEqual({
      name: 'Juan',
      middle_name: 'Carlos',
      paternal_lastname: 'Lopez',
      maternal_lastname: 'Perez',
      email: 'juan@example.com',
      phone: '9612345678',
      role_id: CUSTOM_ROLE.id,
      password: '12345678',
    });
    const created: User = {
      ...WORKER,
      ...request.request.body,
      id: 'new-user',
      role_name: CUSTOM_ROLE.name,
      permissions: CUSTOM_ROLE.permissions,
    };
    request.flush(created);
    await flushUsers([OWNER, WORKER, created]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).textContent;
      })
      .toContain('Juan Carlos Lopez Perez');
    expect(element(fixture).querySelector('dialog')).toBeNull();
    expect(sessionStorage.getItem('pelifolk-session')).toBeNull();
  });

  it('edits user identity and role without sending an unchanged password', async () => {
    await signIn();
    const fixture = await usersPage();
    click(fixture, `[data-user-id="${WORKER.id}"] button[aria-label^="Editar"]`);
    fill(fixture, 'user-name', 'Anita');
    fill(fixture, 'user-role', CUSTOM_ROLE.id);
    submit(fixture);
    const request = http.expectOne({ url: `${api}/users/${WORKER.id}`, method: 'PATCH' });
    expect(request.request.body.role_id).toBe(CUSTOM_ROLE.id);
    expect(request.request.body.name).toBe('Anita');
    expect(request.request.body.password).toBeUndefined();
    request.flush({
      ...WORKER,
      name: 'Anita',
      role_id: CUSTOM_ROLE.id,
      role_name: CUSTOM_ROLE.name,
    });
    await flushUsers([
      OWNER,
      { ...WORKER, name: 'Anita', role_id: CUSTOM_ROLE.id, role_name: CUSTOM_ROLE.name },
    ]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).textContent;
      })
      .toContain('Anita');
  });

  it('requires confirmation to deactivate a user and allows reactivating the account', async () => {
    await signIn();
    const fixture = await usersPage();
    const ownerRow = element(fixture).querySelector(`[data-user-id="${OWNER.id}"]`)!;
    expect(ownerRow).toBeNull();
    const workerRow = element(fixture).querySelector(`[data-user-id="${WORKER.id}"]`)!;
    const deactivate = Array.from(workerRow.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Desactivar',
    )!;
    deactivate.click();
    fixture.detectChanges();
    http.expectNone({ url: `${api}/users/${WORKER.id}`, method: 'DELETE' });
    click(fixture, '[data-testid="confirm-deactivate"]');
    http
      .expectOne({ url: `${api}/users/${WORKER.id}`, method: 'DELETE' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await flushUsers([OWNER, { ...WORKER, active: false }]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector(`[data-user-id="${WORKER.id}"]`)?.textContent;
      })
      .toContain('Inactivo');
    const activate = Array.from(
      element(fixture).querySelector(`[data-user-id="${WORKER.id}"]`)!.querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Activar')!;
    activate.click();
    const request = http.expectOne({ url: `${api}/users/${WORKER.id}`, method: 'PATCH' });
    expect(request.request.body).toEqual({ active: true });
    request.flush(WORKER);
    await flushUsers();
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector(`[data-user-id="${WORKER.id}"]`)?.textContent;
      })
      .toContain('Activo');
  });

  it('excludes the signed-in user even when the API returns that account', async () => {
    await signIn();
    const fixture = await usersPage();
    expect(element(fixture).querySelector(`[data-user-id="${OWNER.id}"]`)).toBeNull();
    expect(element(fixture).querySelector(`[data-user-id="${WORKER.id}"]`)).not.toBeNull();
  });

  it('creates a custom role with selected permissions', async () => {
    await signIn();
    const fixture = await rolesPage();
    click(fixture, '[data-testid="new-role"]');
    fill(fixture, 'role-name', 'supervisor_nuevo');
    choosePermission(fixture, 'users:read', true);
    submit(fixture);
    const request = http.expectOne({ url: `${api}/roles`, method: 'POST' });
    expect(request.request.body).toEqual({ name: 'supervisor_nuevo', permissions: ['users:read'] });
    const created = { ...CUSTOM_ROLE, id: 'new-role', name: 'supervisor_nuevo' };
    request.flush(created);
    await flushRoles([...ROLES, created]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).textContent;
      })
      .toContain('supervisor nuevo');
  });

  it('renames a custom role and removes its management permissions', async () => {
    await signIn();
    const fixture = await rolesPage();
    click(fixture, `[data-role-id="${CUSTOM_ROLE.id}"] button[aria-label^="Editar"]`);
    expect(element(fixture).querySelector<HTMLInputElement>('#role-name')?.disabled).toBe(false);
    fill(fixture, 'role-name', 'asistente');
    choosePermission(fixture, 'users:read', false);
    submit(fixture);
    const request = http.expectOne({ url: `${api}/roles/${CUSTOM_ROLE.id}`, method: 'PUT' });
    expect(request.request.body).toEqual({ name: 'asistente', permissions: [] });
    const updated = { ...CUSTOM_ROLE, name: 'asistente', permissions: [] };
    request.flush(updated);
    await flushRoles([OWNER_ROLE, WORKER_ROLE, updated]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector(`[data-role-id="${CUSTOM_ROLE.id}"]`)?.textContent;
      })
      .toContain('asistente');
  });

  it('edits permissions of initial roles while keeping their names and protecting the owner', async () => {
    await signIn();
    const fixture = await rolesPage();
    expect(
      element(fixture).querySelector(
        `[data-role-id="${OWNER_ROLE.id}"] button[aria-label^="Editar"], [data-role-id="${OWNER_ROLE.id}"] button[aria-label^="Eliminar"]`,
      ),
    ).toBeNull();
    expect(
      element(fixture).querySelector(
        `[data-role-id="${WORKER_ROLE.id}"] button[aria-label^="Eliminar"]`,
      ),
    ).toBeNull();
    click(fixture, `[data-role-id="${WORKER_ROLE.id}"] button[aria-label^="Editar"]`);
    expect(element(fixture).querySelector<HTMLInputElement>('#role-name')?.disabled).toBe(true);
    choosePermission(fixture, 'users:read', true);
    submit(fixture);
    const request = http.expectOne({ url: `${api}/roles/${WORKER_ROLE.id}`, method: 'PUT' });
    expect(request.request.body).toEqual({ name: 'worker', permissions: ['users:read'] });
    request.flush({ ...WORKER_ROLE, permissions: ['users:read'] });
    await flushRoles([OWNER_ROLE, { ...WORKER_ROLE, permissions: ['users:read'] }, CUSTOM_ROLE]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector(`[data-role-id="${WORKER_ROLE.id}"]`)?.textContent;
      })
      .toContain('Consultar usuarios');
  });

  it('shows why an assigned role cannot be deleted and can retry after users are reassigned', async () => {
    await signIn();
    const fixture = await rolesPage();
    click(fixture, `[data-role-id="${CUSTOM_ROLE.id}"] button[aria-label^="Eliminar"]`);
    http.expectNone({ url: `${api}/roles/${CUSTOM_ROLE.id}`, method: 'DELETE' });
    click(fixture, '[data-testid="confirm-delete-role"]');
    http
      .expectOne({ url: `${api}/roles/${CUSTOM_ROLE.id}`, method: 'DELETE' })
      .flush({ detail: 'Role is assigned to users' }, { status: 409, statusText: 'Conflict' });
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector('dialog [role="alert"]')?.textContent;
      })
      .toContain('usuarios asignados');
    click(fixture, '[data-testid="confirm-delete-role"]');
    http
      .expectOne({ url: `${api}/roles/${CUSTOM_ROLE.id}`, method: 'DELETE' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await flushRoles([OWNER_ROLE, WORKER_ROLE]);
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element(fixture).querySelector(`[data-role-id="${CUSTOM_ROLE.id}"]`);
      })
      .toBeNull();
  });

  it('keeps management actions hidden for a read-only account', async () => {
    await signIn({ ...WORKER, permissions: ['users:read', 'roles:read'] });
    const users = await usersPage();
    expect(element(users).querySelector('[data-testid="new-user"]')).toBeNull();
    expect(element(users).querySelector('tbody button')).toBeNull();
    const roles = await rolesPage();
    expect(element(roles).querySelector('[data-testid="new-role"]')).toBeNull();
    expect(
      element(roles).querySelector(
        '[data-role-id] button[aria-label^="Editar"], [data-role-id] button[aria-label^="Eliminar"]',
      ),
    ).toBeNull();
  });

  it('previews three permissions and opens and closes the complete read-only list', async () => {
    await signIn({ ...WORKER, permissions: ['roles:read'] });
    const fixture = await rolesPage();
    const ownerRow = `[data-role-id="${OWNER_ROLE.id}"]`;
    expect(element(fixture).querySelectorAll(`${ownerRow} ul li`)).toHaveLength(3);
    expect(element(fixture).querySelector(ownerRow)?.textContent).not.toContain(
      'Crear y editar usuarios',
    );
    expect(
      element(fixture).querySelector(`[data-role-id="${WORKER_ROLE.id}"]`)?.textContent,
    ).toContain('Sin permisos');
    expect(
      element(fixture).querySelector(
        `[data-role-id="${WORKER_ROLE.id}"] button[aria-haspopup="dialog"]`,
      ),
    ).toBeNull();
    expect(
      element(fixture).querySelector(
        `[data-role-id="${CUSTOM_ROLE.id}"] button[aria-haspopup="dialog"]`,
      ),
    ).toBeNull();

    click(fixture, `${ownerRow} button[aria-haspopup="dialog"]`);
    expect(element(fixture).querySelector('dialog h2')?.textContent).toContain('Dueño');
    expect(element(fixture).querySelectorAll('dialog ul li')).toHaveLength(4);
    expect(element(fixture).querySelector('dialog')?.textContent).toContain(
      'Crear y editar usuarios',
    );
    click(fixture, 'dialog button[aria-label="Cerrar diálogo"]');
    expect(element(fixture).querySelector('dialog')).toBeNull();

    click(fixture, `${ownerRow} button[aria-haspopup="dialog"]`);
    element(fixture)
      .querySelector('dialog')!
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(element(fixture).querySelector('dialog')).toBeNull();
  });

  it('does not request protected data without the required permission', async () => {
    await signIn(WORKER);
    const fixture = TestBed.createComponent(UserList);
    fixture.detectChanges();
    expect(element(fixture).textContent).toContain('No tienes permiso');
    http.expectNone((req) => req.url === `${api}/users`);
    http.expectNone(`${api}/roles`);
  });

  it('sends cookies only to this API and redirects to login when a protected request is rejected', async () => {
    await signIn();
    const client = TestBed.inject(HttpClient);
    client.get('https://example.com/data').subscribe();
    const outside = http.expectOne('https://example.com/data');
    expect(outside.request.headers.has('Authorization')).toBe(false);
    outside.flush({});
    client.get(`${api}/roles`).subscribe({ error: () => {} });
    http
      .expectOne(`${api}/roles`)
      .flush({ detail: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });
    await expect.poll(() => TestBed.inject(Router).url).toContain('/login');
    expect(TestBed.inject(Session).user()).toBeNull();
    expect(sessionStorage.getItem('pelifolk-session')).toBeNull();
  });

  it('refreshes the current permissions when access is revoked during a session', async () => {
    await signIn();
    TestBed.inject(HttpClient)
      .get(`${api}/users`)
      .subscribe({ error: () => {} });
    http
      .expectOne(`${api}/users`)
      .flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${api}/auth/me`).flush({ ...OWNER, permissions: ['roles:read'] });
    await expect.poll(() => TestBed.inject(Session).user()?.permissions).toEqual(['roles:read']);
    expect(await TestBed.inject(Session).isAuthenticated()).toBe(true);
  });
});
