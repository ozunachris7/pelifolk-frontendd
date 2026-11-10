import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { ObservationCase } from './observation-case';
const source = {
  id: 'o1',
  animal: { id: 'a1', name: 'Estrella', siniiga: null },
  date: '2024-02-01',
  observation: 'Hallazgo original.',
  recorded_by: 'Trabajador',
};
const healthCase = {
  id: 'c1',
  animal: source.animal,
  reason: 'Cojera',
  status: 'open',
  start_date: '2024-02-02',
  closed_date: null,
  notes: null,
};
describe('Case from observation', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObservationCase],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        {
          provide: Session,
          useValue: {
            user: () => ({
              permissions: [
                'health:read',
                'health:observations:create',
                'health:cases:write',
                'health:diagnoses:create',
                'health:treatments:create',
                'health:doses:create',
                'health:followups:create',
                'health:products:write',
                'health:programs:write',
                'health:program_applications:create',
                'health:reactions:write',
                'health:incidents:write',
              ],
            }),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture() {
    const f = TestBed.createComponent(ObservationCase);
    f.componentRef.setInput('observation', source);
    f.detectChanges();
    return f;
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    f.detectChanges();
  }
  function submit(f: any) {
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
  }
  it('sends the immutable source and same animal when creating a case', async () => {
    const f = fixture();
    const linked = vi.fn();
    f.componentInstance.linked.subscribe(linked);
    fill(f, 'source-case-date', '2024-02-02');
    fill(f, 'source-case-reason', ' Cojera ');
    submit(f);
    const req = http.expectOne('/api/health/cases');
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      observation_id: 'o1',
      start_date: '2024-02-02',
      reason: 'Cojera',
      notes: null,
    });
    expect(f.nativeElement.textContent).toContain('Trabajador');
    expect(f.nativeElement.textContent).toContain('Hallazgo original.');
    req.flush(healthCase);
    await f.whenStable();
    expect(linked).toHaveBeenCalledWith('c1');
  });
  it('rejects dates earlier than the source without losing form data', () => {
    const f = fixture();
    fill(f, 'source-case-date', '2024-01-31');
    fill(f, 'source-case-reason', 'Cojera');
    submit(f);
    http.expectNone('/api/health/cases');
    expect(f.nativeElement.textContent).toContain('El inicio debe estar entre');
    expect(f.nativeElement.querySelector('#source-case-reason').value).toBe('Cojera');
  });
  it('loads eligible cases, links an existing case and preserves inputs on conflict', async () => {
    const f = fixture();
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Vincular a caso existente'))
      .click();
    f.detectChanges();
    http.expectOne((r) => r.url === '/api/health/observations/o1/case-options').flush([healthCase]);
    await f.whenStable();
    f.detectChanges();
    fill(f, 'source-case-select', 'c1');
    submit(f);
    const req = http.expectOne('/api/health/observations/o1/case-link');
    expect(req.request.body).toEqual({ case_id: 'c1' });
    req.flush(
      { detail: 'Observation already linked to another case' },
      { status: 409, statusText: 'Conflict' },
    );
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('ya está vinculada');
    expect(f.nativeElement.querySelector('#source-case-select').value).toBe('c1');
  });
});
