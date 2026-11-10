import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Session } from '../auth/session';
import { API_URL } from './api-url';
import { authInterceptor } from './auth.interceptor';

describe('Cookie authentication interceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'sends cookies and CSRF protection on %s, including multipart uploads',
    (method) => {
      const api = TestBed.inject(API_URL);
      const body = new FormData();
      body.append('photo', new Blob(['photo']), 'photo.png');
      TestBed.inject(HttpClient).request(method, `${api}/profile/photo`, { body }).subscribe();
      const request = TestBed.inject(HttpTestingController).expectOne(`${api}/profile/photo`);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.headers.has('Content-Type')).toBe(false);
      expect(request.request.body).toBe(body);
      request.flush({});
    },
  );

  it.each([
    'https://example.com/data',
    'http://localhost:8000/api/v10/users',
    'http://localhost.evil.example:8000/api/v1/users',
  ])('does not attach credentials or CSRF headers to %s', (url) => {
    TestBed.inject(HttpClient).post(url, {}).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('X-CSRF-Protection')).toBe(false);
    request.flush({});
  });

  it('recognizes relative production API paths and absolute same-origin URLs', () => {
    TestBed.overrideProvider(API_URL, { useValue: '/api/v1' });
    const origin = new URL(TestBed.inject(DOCUMENT).baseURI).origin;
    for (const url of ['/api/v1/auth/login', `${origin}/api/v1/auth/login`]) {
      TestBed.inject(HttpClient).post(url, {}).subscribe();
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');
      request.flush({});
    }
  });

  it('ignores a protected request rejection from before a new login', async () => {
    const api = TestBed.inject(API_URL);
    const http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    TestBed.inject(HttpClient)
      .get(`${api}/animals`)
      .subscribe({ error: () => {} });
    const oldRequest = http.expectOne(`${api}/animals`);
    const login = session.login('juan@example.com', 'password');
    http.expectOne(`${api}/auth/login`).flush({ expires_in: 1800, user: { id: 'new-user' } });
    await login;
    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.user()?.id).toBe('new-user');
    expect(navigate).not.toHaveBeenCalled();
  });
});
