import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { AnimalTimeline } from './animal-timeline';
const page = {
  items: [
    {
      id: 'w1',
      date: '2026-10-14',
      kind: 'event',
      module: 'weights',
      title: 'Destete',
      details: [
        { label: 'Peso (kg)', value: '18.50' },
        { label: 'Edad al registrar', value: '74 días' },
      ],
      notes: 'Destete registrado.',
      recorded_by: 'Cristopher',
    },
  ],
  total: 26,
  offset: 0,
  limit: 25,
  modules: ['animals', 'weights'],
  date_from: null,
  date_to: null,
};
describe('Animal timeline', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimalTimeline],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        {
          provide: Session,
          useValue: { user: () => ({ permissions: ['animals:read', 'weights:read'] }) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture() {
    const f = TestBed.createComponent(AnimalTimeline);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    return f;
  }
  function open(f: any) {
    f.nativeElement.querySelector('[data-testid=toggle-timeline]').click();
    f.detectChanges();
    return http.expectOne((r) => r.url === '/api/animals/a1/timeline');
  }
  it('loads on demand and restricts module options', () => {
    const f = fixture();
    http.expectNone((r) => r.url.includes('/timeline'));
    open(f).flush(page);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('74 días');
    expect(f.nativeElement.textContent).toContain('Cristopher');
    const options = [...f.nativeElement.querySelectorAll('#timeline-module option')].map(
      (o: any) => o.value,
    );
    expect(options).toEqual(['', 'animals', 'weights']);
  });
  it('paginates with applied filters and blocks reversed dates', () => {
    const f = fixture();
    open(f).flush(page);
    f.detectChanges();
    const fill = (id: string, v: string) => {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = v;
      e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    };
    fill('timeline-module', 'weights');
    fill('timeline-from', '2026-10-01');
    fill('timeline-to', '2026-10-14');
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    const req = http.expectOne((r) => r.url.endsWith('/timeline'));
    expect(req.request.params.get('module')).toBe('weights');
    expect(req.request.params.get('date_from')).toBe('2026-10-01');
    req.flush(page);
    f.detectChanges();
    fill('timeline-from', '2026-11-01');
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.trim() === 'Siguiente')
      .click();
    f.detectChanges();
    const next = http.expectOne((r) => r.url.endsWith('/timeline'));
    expect(next.request.params.get('offset')).toBe('25');
    expect(next.request.params.get('date_from')).toBe('2026-10-01');
    next.flush({ ...page, offset: 25 });
    f.detectChanges();
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('La fecha Desde');
    http.expectNone((r) => r.url.endsWith('/timeline'));
  });
  it('cancels stale animal requests and distinguishes errors from empty history', () => {
    const f = fixture(),
      old = open(f);
    f.componentRef.setInput('animalId', 'a2');
    f.detectChanges();
    expect(old.cancelled).toBe(true);
    http
      .expectOne((r) => r.url === '/api/animals/a2/timeline')
      .flush({}, { status: 500, statusText: 'Error' });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('No hay registros');
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.trim() === 'Reintentar')
      .click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/timeline')).flush({ ...page, items: [], total: 0 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay registros');
  });
});
