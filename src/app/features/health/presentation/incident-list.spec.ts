import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { IncidentList } from './incident-list';
const animal = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const row = {
  id: 'i1',
  animal,
  date: '2024-01-04',
  kind: 'accident',
  description: 'Reporte original que debe conservarse.',
  location: 'Corral norte',
  initial_actions: 'Se avisó al encargado.',
  health_case: null,
  status: 'open',
  version: 0,
  recorded_by: 'Cristopher Ozuna',
};
const page = (items: unknown[] = []) => ({ items, total: items.length, offset: 0, limit: 25 });
const detail = (incident = row) => ({ incident, last_followup_date: null, followups: page() });
describe('Animal incidents', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = [
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
    ];
    await TestBed.configureTestingModule({
      imports: [IncidentList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function open() {
    const f = TestBed.createComponent(IncidentList);
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/health/incidents')).flush(page([row]));
    return { f, h };
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input'));
    f.detectChanges();
  }
  it('does not request clinical records without permission and hides writing from readers', async () => {
    permissions = [];
    const f = TestBed.createComponent(IncidentList);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/health/'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    f.destroy();
    permissions = ['health:read'];
    const { f: g, h } = open();
    await expect
      .poll(() => {
        g.detectChanges();
        return g.nativeElement.textContent;
      })
      .toContain('Luna');
    expect(g.nativeElement.querySelector('[data-new-incident]')).toBeNull();
    g.nativeElement.querySelector('[data-incident-row] button').click();
    g.detectChanges();
    h.expectOne((r) => r.url.endsWith('/incidents/i1')).flush(detail());
    await expect
      .poll(() => {
        g.detectChanges();
        return g.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain(row.description);
    expect(g.nativeElement.querySelector('[data-new-followup]')).toBeNull();
  });
  it('creates an incident without requiring a case and opens its original report', async () => {
    const { f, h } = open();
    f.nativeElement.querySelector('[data-new-incident]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/health/animal-options')).flush([animal]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#incident-animal')?.options.length;
      })
      .toBe(2);
    fill(f, 'incident-animal', 'a1');
    const cases = h.expectOne((r) => r.url.endsWith('/incidents/case-options'));
    expect(cases.request.params.get('animal_id')).toBe('a1');
    cases.flush([]);
    fill(f, 'incident-date', '2024-01-04');
    fill(f, 'incident-description', '  Reporte observado  ');
    f.nativeElement
      .querySelector('app-detail-page form, dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/health/incidents') && r.method === 'POST');
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      date: '2024-01-04',
      kind: 'accident',
      description: 'Reporte observado',
      location: null,
      initial_actions: null,
      health_case_id: null,
    });
    req.flush(row);
    await expect
      .poll(() => {
        f.detectChanges();
        h.match((r) => r.url.endsWith('/health/incidents')).forEach((r) => r.flush(page([row])));
        h.match((r) => r.url.endsWith('/incidents/i1')).forEach((r) => r.flush(detail()));
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('Reporte original');
  });
  it('keeps the note when a concurrent update rejects its version', async () => {
    const { f, h } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-incident-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-incident-row] button').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/incidents/i1')).flush(detail());
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-new-followup]');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-new-followup]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/incidents/case-options')).flush([]);
    fill(f, 'incident-follow-date', '2024-01-05');
    fill(f, 'incident-follow-status', 'closed');
    fill(f, 'incident-follow-notes', 'Se concluyó el seguimiento.');
    f.nativeElement
      .querySelector('app-detail-page form, dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/incidents/i1/followups'));
    expect(req.request.body).toEqual({
      date: '2024-01-05',
      status: 'closed',
      notes: 'Se concluyó el seguimiento.',
      health_case_id: null,
      expected_version: 0,
    });
    req.flush(
      { detail: 'Incident changed; reload before updating' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El incidente recibió un seguimiento nuevo');
    expect(f.nativeElement.querySelector('#incident-follow-notes').value).toBe(
      'Se concluyó el seguimiento.',
    );
    expect(f.nativeElement.querySelector('app-detail-page, dialog').textContent).toContain(
      row.description,
    );
  });
  it('reopens a closed incident with a new note while retaining prior follow-ups', async () => {
    const { f, h } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-incident-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-incident-row] button').click();
    f.detectChanges();
    const closed = { ...row, status: 'closed', version: 1 };
    h.expectOne((r) => r.url.endsWith('/incidents/i1')).flush({
      incident: closed,
      last_followup_date: '2024-01-05',
      followups: page([
        {
          id: 'f1',
          version: 1,
          date: '2024-01-05',
          status: 'closed',
          notes: 'Cierre anterior.',
          recorded_by: 'Cristopher',
        },
      ]),
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-new-followup]');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-new-followup]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/incidents/case-options')).flush([]);
    expect(f.nativeElement.querySelector('#incident-follow-status').value).toBe('open');
    fill(f, 'incident-follow-date', '2024-01-06');
    fill(f, 'incident-follow-notes', 'Se reabre para completar el seguimiento.');
    f.nativeElement
      .querySelector('app-detail-page form, dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/incidents/i1/followups'));
    expect(req.request.body.expected_version).toBe(1);
    req.flush({
      incident: { ...row, version: 2 },
      last_followup_date: '2024-01-06',
      followups: page([
        {
          id: 'f2',
          version: 2,
          date: '2024-01-06',
          status: 'open',
          notes: 'Se reabre para completar el seguimiento.',
          recorded_by: 'Cristopher',
        },
        {
          id: 'f1',
          version: 1,
          date: '2024-01-05',
          status: 'closed',
          notes: 'Cierre anterior.',
          recorded_by: 'Cristopher',
        },
      ]),
    });
    await expect
      .poll(() => {
        f.detectChanges();
        h.match((r) => r.url.endsWith('/health/incidents')).forEach((r) => r.flush(page([row])));
        return f.nativeElement.querySelectorAll('[data-incident-followup]').length;
      })
      .toBe(2);
    expect(f.nativeElement.querySelector('app-detail-page, dialog').textContent).toContain(
      'Cierre anterior.',
    );
  });
  it('drops case selection and ignores old case options when the animal changes', async () => {
    const { f, h } = open();
    f.nativeElement.querySelector('[data-new-incident]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/health/animal-options')).flush([
      animal,
      { ...animal, id: 'a2', name: 'Estrella' },
    ]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#incident-animal')?.options.length;
      })
      .toBe(3);
    fill(f, 'incident-animal', 'a1');
    const old = h.expectOne((r) => r.url.endsWith('/incidents/case-options'));
    fill(f, 'incident-animal', 'a2');
    h.expectOne((r) => r.url.endsWith('/incidents/case-options')).flush([]);
    old.flush([
      { id: 'wrong-case', reason: 'Caso de otro animal', start_date: '2024-01-01', status: 'open' },
    ]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#incident-case')?.options.length;
      })
      .toBe(1);
    expect(f.nativeElement.textContent).not.toContain('Caso de otro animal');
  });
});
