import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Profile } from './profile';
import { Session, SessionUser } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { authInterceptor } from '../../core/http/auth.interceptor';

const USER: SessionUser = {
  id: 'worker',
  name: 'Mateo',
  middle_name: null,
  paternal_lastname: 'Lopez',
  maternal_lastname: 'Perez',
  email: 'mateo@example.com',
  phone: null,
  active: true,
  role_id: 'role-worker',
  role_name: 'worker',
  permissions: [],
  profile_photo_url: null,
};
const API = 'http://localhost:8000/api/v1';

describe('Own profile photo', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
      ],
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:preview-photo'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const login = TestBed.inject(Session).login(USER.email, 'private-password');
    TestBed.inject(HttpTestingController).expectOne(`${API}/auth/login`).flush({
      expires_in: 1800,
      user: USER,
    });
    await login;
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
  });

  function open() {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const choose = (file: File) => {
      const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const save = () =>
      [...element.querySelectorAll('button')]
        .find((b) => b.textContent?.includes('Guardar foto'))!
        .click();
    return { fixture, element, choose, save };
  }

  it('shows separate identity fields to a user without administration permissions', () => {
    const { element } = open();
    expect(element.textContent).toContain('Mi perfil');
    expect(element.textContent).toContain('Segundo nombre');
    expect(element.textContent).toContain(USER.email);
    expect(element.textContent).toContain('Agregar foto');
  });

  it('uploads multipart with own token and refreshes the session avatar URL', async () => {
    const { fixture, element, choose, save } = open();
    const file = new File(['fake jpeg'], 'camera.jpg', { type: 'image/jpeg' });
    choose(file);
    save();
    save();
    const req = TestBed.inject(HttpTestingController).expectOne(`${API}/profile/photo`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('file')).toBe(file);
    req.flush({
      ...USER,
      profile_photo_url: '/upload/photos_profile/workermateo20261017000000000001.webp',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Foto de perfil actualizada');
    expect(TestBed.inject(Session).photoUrl()).toBe(
      'http://localhost:8000/upload/photos_profile/workermateo20261017000000000001.webp',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-photo');
    expect(element.textContent).toContain('Cambiar foto');
  });

  it('keeps the existing photo if the server rejects the selected image', async () => {
    const session = TestBed.inject(Session);
    session.updateIdentity({
      ...USER,
      profile_photo_url: '/upload/photos_profile/workermateo20261017000000000001.webp',
    });
    const { fixture, element, choose, save } = open();
    choose(new File(['corrupt'], 'camera.png', { type: 'image/png' }));
    save();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API}/profile/photo`)
      .flush(
        { detail: 'La imagen no es válida o está dañada' },
        { status: 422, statusText: 'Invalid' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('dañada');
    expect(session.user()?.profile_photo_url).toContain('000001.webp');
    expect(element.textContent).toContain('Guardar foto');
  });

  it('rejects oversized and unsupported files without sending a request', () => {
    const { element, choose } = open();
    choose(new File(['x'], 'script.svg', { type: 'image/svg+xml' }));
    expect(element.querySelector('[role=alert]')?.textContent).toContain('JPEG, PNG o WebP');
    const file = new File(['x'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    choose(file);
    expect(element.querySelector('[role=alert]')?.textContent).toContain('5 MB');
    TestBed.inject(HttpTestingController).expectNone(`${API}/profile/photo`);
  });

  it('releases previews on cancel and component destruction', () => {
    const { fixture, element, choose } = open();
    choose(new File(['x'], 'camera.jpg', { type: 'image/jpeg' }));
    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Cancelar'))!
      .click();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    choose(new File(['y'], 'camera2.jpg', { type: 'image/jpeg' }));
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('edits separate identity fields and refreshes the current user without changing the photo or role', async () => {
    const session = TestBed.inject(Session);
    const photo = '/upload/photos_profile/workermateo20261017000000000001.webp';
    session.updateIdentity({ ...USER, profile_photo_url: photo });
    const { fixture, element } = open();
    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Editar datos'))!
      .click();
    fixture.detectChanges();
    for (const [field, value] of Object.entries({
      name: 'Mateo nuevo',
      middle_name: 'Andres',
      email: 'mateo.nuevo@example.com',
    })) {
      const input = element.querySelector<HTMLInputElement>('#profile-' + field)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne(`${API}/profile`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toEqual({
      name: 'Mateo nuevo',
      middle_name: 'Andres',
      email: 'mateo.nuevo@example.com',
    });
    request.flush({
      ...USER,
      name: 'Mateo nuevo',
      middle_name: 'Andres',
      email: 'mateo.nuevo@example.com',
      profile_photo_url: photo,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Información actualizada.');
    expect(element.textContent).toContain('Mateo nuevo');
    expect(element.querySelector('form')).toBeNull();
    expect(session.user()?.name).toBe('Mateo nuevo');
    expect(session.user()?.profile_photo_url).toBe(photo);
    expect(session.user()?.role_name).toBe('worker');
  });

  it('keeps the draft and current identity when the email already belongs to another user', async () => {
    const { fixture, element } = open();
    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Editar datos'))!
      .click();
    fixture.detectChanges();
    const email = element.querySelector<HTMLInputElement>('#profile-email')!;
    email.value = 'duplicate@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API}/profile`)
      .flush(
        { detail: 'Duplicate value or invalid relationship' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      'correo ya está registrado',
    );
    expect(email.value).toBe('duplicate@example.com');
    expect(TestBed.inject(Session).user()?.email).toBe(USER.email);
  });

  it('validates required fields locally and cancel discards an unsaved draft', () => {
    const { fixture, element } = open();
    const edit = () =>
      [...element.querySelectorAll('button')]
        .find((b) => b.textContent?.includes('Editar datos'))!
        .click();
    edit();
    fixture.detectChanges();
    const name = element.querySelector<HTMLInputElement>('#profile-name')!;
    name.value = ' ';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectNone(`${API}/profile`);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    [...element.querySelectorAll<HTMLButtonElement>('form button')]
      .find((b) => b.textContent?.includes('Cancelar'))!
      .click();
    fixture.detectChanges();
    edit();
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#profile-name')!.value).toBe(USER.name);
  });
});
