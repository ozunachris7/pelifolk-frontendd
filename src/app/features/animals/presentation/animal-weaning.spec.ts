import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnimalWeaning } from './animal-weaning';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';

describe('Weaning in animal detail', () => {
  const user = signal({ permissions: ['weights:read'] });
  let http: HttpTestingController;
  beforeEach(async () => {
    user.set({ permissions: ['weights:read'] });
    await TestBed.configureTestingModule({
      imports: [AnimalWeaning],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user } },
        { provide: API_URL, useValue: '/api' },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function open() {
    const f = TestBed.createComponent(AnimalWeaning);
    f.componentRef.setInput('animalId', 'estrella');
    f.detectChanges();
    return f;
  }
  it('shows recorded date, weight and historical age', () => {
    const f = open();
    http
      .expectOne('/api/weanings/animals/estrella')
      .flush({
        date: '2026-10-14',
        weight_kg: '18.50',
        age_days: 74,
        notes: 'Destete registrado.',
        recorded_by: 'Cristopher Ozuna',
      });
    f.detectChanges();
    const content = f.nativeElement.textContent;
    expect(content).toContain('14/10/2026');
    expect(content).toContain('18.50 kg');
    expect(content).toContain('74 días');
    expect(content).toContain('Cristopher Ozuna');
  });
  it('distinguishes no record from an unknown age', () => {
    const f = open();
    http.expectOne('/api/weanings/animals/estrella').flush(null);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin destete registrado.');
    f.componentRef.setInput('animalId', 'otro');
    f.detectChanges();
    http
      .expectOne('/api/weanings/animals/otro')
      .flush({
        date: '2026-10-14',
        weight_kg: '18.50',
        age_days: null,
        notes: null,
        recorded_by: 'Cris',
      });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Desconocida');
  });
  it('does not request or show restricted data', () => {
    user.set({ permissions: [] });
    const f = open();
    http.expectNone('/api/weanings/animals/estrella');
    expect(f.nativeElement.textContent.trim()).toBe('');
  });
  it('cancels an old animal request and allows retrying errors', () => {
    const f = open();
    const old = http.expectOne('/api/weanings/animals/estrella');
    f.componentRef.setInput('animalId', 'otro');
    f.detectChanges();
    expect(old.cancelled).toBe(true);
    http.expectOne('/api/weanings/animals/otro').flush({}, { status: 500, statusText: 'Error' });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Sin destete registrado.');
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    http.expectOne('/api/weanings/animals/otro').flush(null);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin destete registrado.');
  });
});
