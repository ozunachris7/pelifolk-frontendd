import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { AnimalReport } from './animal-report';
const page = { as_of: '2026-10-10', items: [], total: 0, female: 0, male: 0, offset: 0, limit: 25 };
describe('Animal report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimalReport],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['animals:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('applies filters and exports the applied results rather than unsaved edits', async () => {
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const f = TestBed.createComponent(AnimalReport);
    f.detectChanges();
    http.expectOne(`${url}/reports/animals/options`).flush({ breeds: [], groups: [] });
    http.expectOne((r) => r.url === `${url}/reports/animals`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 animales');
    const input = f.nativeElement.querySelector('#report-search');
    input.value = 'Luna';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const r = http.expectOne((r) => r.url === `${url}/reports/animals`);
    expect(r.request.params.get('q')).toBe('Luna');
    r.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 animales');
    input.value = 'Trueno';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Descargar Excel'))!
      .click();
    const x = http.expectOne(`${url}/reports/animals/export?q=Luna&status=active`);
    expect(x.request.responseType).toBe('blob');
    x.flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('does not request data without read permission', () => {
    TestBed.overrideProvider(Session, { useValue: { user: () => ({ permissions: [] }) } });
    const f = TestBed.createComponent(AnimalReport);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/reports/'));
  });
});
