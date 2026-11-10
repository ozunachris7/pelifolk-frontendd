import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../http/api-url';
import { authInterceptor } from '../http/auth.interceptor';
import { Session, SessionUser } from './session';

const USER: SessionUser = {
  id: 'user-id',
  name: 'Juan',
  middle_name: 'Carlos',
  paternal_lastname: 'Lopez',
  maternal_lastname: 'Perez',
  email: 'juan@example.com',
  phone: null,
  active: true,
  role_id: 'role-id',
  role_name: 'worker',
  permissions: [],
};

describe('Session cookie integration', () => {
  let http: HttpTestingController;
  let api: string;
  beforeEach(() => {
    sessionStorage.removeItem('pelifolk-session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
    vi.restoreAllMocks();
  });

  async function signIn() {
    const session = TestBed.inject(Session);
    const pending = session.login(' JUAN@example.com ', 'Exact password ');
    const request = http.expectOne(`${api}/auth/login`);
    expect(request.request.body).toEqual({ email: USER.email, password: 'Exact password ' });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ expires_in: 1800, user: USER });
    await pending;
    return session;
  }

  it('logs in with cookies and keeps identity only in memory', async () => {
    const session = await signIn();
    expect(session.user()).toEqual(USER);
    expect(await session.isAuthenticated()).toBe(true);
    expect(sessionStorage.getItem('pelifolk-session')).toBeNull();
    expect(localStorage.getItem('pelifolk-session')).toBeNull();
  });

  it('does not create a session when credentials are rejected', async () => {
    const session = TestBed.inject(Session);
    const login = session.login(USER.email, 'invalid');
    const rejected = expect(login).rejects.toMatchObject({ status: 401 });
    http.expectOne(`${api}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(session.user()).toBeNull();
    expect(await session.isAuthenticated()).toBe(false);
  });

  it('restores the browser cookie through a single me request for concurrent guards', async () => {
    const session = TestBed.inject(Session);
    const first = session.isAuthenticated();
    const second = session.isAuthenticated();
    const request = http.expectOne(`${api}/auth/me`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-CSRF-Protection')).toBe(false);
    request.flush(USER);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(session.user()).toEqual(USER);
  });

  it('clears a revoked session and remembers an unauthenticated result', async () => {
    const session = TestBed.inject(Session);
    const validation = session.isAuthenticated();
    http.expectOne(`${api}/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await validation).toBe(false);
    expect(await session.isAuthenticated()).toBe(false);
    expect(session.user()).toBeNull();
  });

  it('removes legacy stored tokens and validates only the browser cookie', async () => {
    sessionStorage.setItem(
      'pelifolk-session',
      JSON.stringify({ accessToken: 'obsolete-token', expiresAt: Date.now() + 60_000 }),
    );
    const session = TestBed.inject(Session);
    expect(sessionStorage.getItem('pelifolk-session')).toBeNull();
    const validation = session.isAuthenticated();
    const request = http.expectOne(`${api}/auth/me`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(USER);
    expect(await validation).toBe(true);
  });

  it('expires a newly logged-in session using the server lifetime', async () => {
    const session = await signIn();
    const future = Date.now() + 1_801_000;
    vi.spyOn(Date, 'now').mockReturnValue(future);
    expect(await session.isAuthenticated()).toBe(false);
    expect(session.user()).toBeNull();
  });

  it('waits for server logout to delete the HttpOnly cookie', async () => {
    const session = await signIn();
    const logout = session.logout();
    expect(session.user()).toEqual(USER);
    const request = http.expectOne(`${api}/auth/logout`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(session.user()).toBeNull();
    expect(await session.isAuthenticated()).toBe(false);
  });

  it('allows retrying logout when the server could not delete the cookie', async () => {
    const session = await signIn();
    const logout = session.logout();
    const rejected = expect(logout).rejects.toMatchObject({ status: 0 });
    http.expectOne(`${api}/auth/logout`).error(new ProgressEvent('error'));
    await rejected;
    expect(session.user()).toEqual(USER);
    const retry = session.logout();
    http.expectOne(`${api}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await retry;
    expect(session.user()).toBeNull();
  });

  it('accepts logout when the cookie has already expired', async () => {
    const session = await signIn();
    const logout = session.logout();
    http.expectOne(`${api}/auth/logout`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await logout;
    expect(await session.isAuthenticated()).toBe(false);
  });

  it('does not restore an identity from a me response arriving after logout', async () => {
    const session = TestBed.inject(Session);
    const validation = session.isAuthenticated();
    const request = http.expectOne(`${api}/auth/me`);
    const logout = session.logout();
    http.expectOne(`${api}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    request.flush(USER);
    expect(await validation).toBe(false);
    expect(session.user()).toBeNull();
  });

  it('ignores validation failures from a previous session after a new login', async () => {
    const session = TestBed.inject(Session);
    const validation = session.isAuthenticated();
    const oldRequest = http.expectOne(`${api}/auth/me`);
    await signIn();
    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await validation).toBe(false);
    expect(session.user()).toEqual(USER);
  });

  it('retries cookie restoration after a temporary network failure', async () => {
    const session = TestBed.inject(Session);
    const first = session.isAuthenticated();
    http.expectOne(`${api}/auth/me`).error(new ProgressEvent('error'));
    expect(await first).toBe(false);
    const retry = session.isAuthenticated();
    http.expectOne(`${api}/auth/me`).flush(USER);
    expect(await retry).toBe(true);
  });
});
