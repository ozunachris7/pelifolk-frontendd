import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { Session, SessionUser } from './core/auth/session';
import { API_URL } from './core/http/api-url';

const USER: SessionUser = {
  id: 'test-user',
  name: 'Juan',
  middle_name: 'Carlos',
  paternal_lastname: 'Lopez',
  maternal_lastname: 'Perez',
  email: 'juan@example.com',
  phone: null,
  active: true,
  role_id: 'test-role',
  role_name: 'owner',
  permissions: [],
};
const PASSWORD = 'Created-user-password123';

async function signIn(permissions = USER.permissions): Promise<void> {
  const result = TestBed.inject(Session).login(USER.email, PASSWORD);
  TestBed.inject(HttpTestingController)
    .expectOne(`${TestBed.inject(API_URL)}/auth/login`)
    .flush({
      expires_in: 1800,
      user: { ...USER, permissions },
    });
  await result;
}

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const validation = TestBed.inject(Session).isAuthenticated();
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/auth/me`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await validation;
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.removeItem('pelifolk-session');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the dashboard and navigate to a section', async () => {
    await signIn(['animals:read']);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    flushSummary();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/dashboard/overview');
    expect(compiled.querySelector('app-header header a')?.getAttribute('aria-label')).toBe(
      'Pelifolk, inicio',
    );
    expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Resumen del rancho');
    const reportsLink = compiled.querySelector<HTMLAnchorElement>(
      'app-sidebar a[href="/dashboard/reports"]',
    );
    expect(reportsLink).toBeTruthy();
    reportsLink!.click();
    await expect.poll(() => router.url).toBe('/dashboard/reports');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne(`${TestBed.inject(API_URL)}/reports/animals/options`)
      .flush({ breeds: [], groups: [] });
    http
      .expectOne((r) => r.url === `${TestBed.inject(API_URL)}/reports/animals`)
      .flush({
        as_of: '2026-10-10',
        items: [],
        total: 0,
        female: 0,
        male: 0,
        offset: 0,
        limit: 25,
      });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/dashboard/reports');
    expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Reporte de animales');
    expect(reportsLink!.getAttribute('aria-current')).toBe('page');
  });

  it('should switch themes and sign out from the profile dropdown', async () => {
    const previousTheme = localStorage.getItem('pelifolk-theme');
    const previousDark = document.documentElement.classList.contains('dark');
    try {
      document.documentElement.classList.remove('dark');
      const session = TestBed.inject(Session);
      await signIn();
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      await TestBed.inject(Router).navigateByUrl('/dashboard/overview');
      fixture.detectChanges();
      flushSummary();
      await fixture.whenStable();
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLButtonElement>('button[aria-label="Activar modo oscuro"]')!.click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('pelifolk-theme')).toBe('dark');
      element.querySelector<HTMLButtonElement>('button[aria-label="Activar modo claro"]')!.click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      const profile = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Opciones de usuario"]',
      )!;
      profile.click();
      fixture.detectChanges();
      expect(element.querySelector('#profile-options')?.textContent).toContain('Juan');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(profile.getAttribute('aria-expanded')).toBe('false');
      profile.click();
      fixture.detectChanges();
      element.querySelector<HTMLButtonElement>('#profile-options button')!.click();
      fixture.detectChanges();
      TestBed.inject(HttpTestingController)
        .expectOne(`${TestBed.inject(API_URL)}/auth/logout`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();
      expect(session.user()).toBeNull();
      expect(element.querySelector('#profile-options')).toBeNull();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/login');
    } finally {
      document.documentElement.classList.toggle('dark', previousDark);
      if (previousTheme === null) localStorage.removeItem('pelifolk-theme');
      else localStorage.setItem('pelifolk-theme', previousTheme);
    }
  });

  it('should require login, reject invalid credentials and return to the requested section', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard/animals');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toContain('/login');
    const element = fixture.nativeElement as HTMLElement;
    const fill = (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('email', USER.email);
    fill('password', 'incorrect');
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${TestBed.inject(API_URL)}/auth/login`,
    );
    expect(request.request.body).toEqual({
      email: USER.email,
      password: 'incorrect',
    });
    request.flush(
      { detail: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element.querySelector('[role="alert"]')?.textContent;
      })
      .toContain('incorrectos');
    expect(TestBed.inject(Session).user()).toBeNull();
    element.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/auth/login`)
      .flush({ detail: 'Too many login attempts' }, { status: 429, statusText: 'Too Many Requests' });
    await expect.poll(() => {
      fixture.detectChanges();
      return element.querySelector('[role="alert"]')?.textContent;
    }).toContain('Demasiados intentos');
    expect(TestBed.inject(Session).user()).toBeNull();
    fill('password', PASSWORD);
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/auth/login`)
      .flush({
        expires_in: 1800,
        user: USER,
      });
    await expect.poll(() => router.url).toBe('/dashboard/animals');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(Session).user()?.name).toBe('Juan');
    expect(sessionStorage.getItem('pelifolk-session')).toBeNull();
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    flushSummary();
    expect(router.url).toBe('/dashboard/overview');
  });

  it('shows a connection error and allows retrying when the API is unavailable', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/login');
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['email', USER.email],
      ['password', PASSWORD],
    ]) {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/auth/login`)
      .error(new ProgressEvent('error'));
    await expect
      .poll(() => {
        fixture.detectChanges();
        return element.querySelector('[role="alert"]')?.textContent;
      })
      .toContain('No se pudo conectar');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(TestBed.inject(Session).user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});

function flushSummary() {
  TestBed.inject(HttpTestingController)
    .expectOne(`${TestBed.inject(API_URL)}/dashboard/summary`)
    .flush({
      as_of: '2026-10-10',
      period_from: '2026-10-01',
      period_to: '2026-10-10',
      herd: null,
      health: null,
      breeding: null,
      finance: null,
      feeding: null,
      activity: [],
    });
}
