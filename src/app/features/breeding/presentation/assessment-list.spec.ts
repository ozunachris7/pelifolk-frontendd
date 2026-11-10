import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { AssessmentList } from './assessment-list';
const mother = { id: 'm1', name: 'Luna', siniiga: 'MX1' },
  child = { id: 'c1', name: 'Estrella', siniiga: 'MX2' };
const birth = {
  id: 'b1',
  date: '2024-06-01',
  mother,
  offspring: [{ animal: child, alive_at_birth: true }],
};
const maternal = {
  version: 'breeding_descriptive_v1',
  scoring: 'descriptive',
  criteria: [
    { code: 'acceptance', label: 'Aceptación de las crías', description: 'Describe lo observado.' },
    { code: 'nursing', label: 'Amamantamiento observado', description: 'Describe la respuesta.' },
    { code: 'care', label: 'Cuidado y atención', description: 'Describe el cuidado.' },
  ],
};
const offspring = {
  ...maternal,
  criteria: [
    {
      code: 'body_features',
      label: 'Características físicas de la cría',
      description: 'Describe rasgos visibles.',
    },
    { code: 'movement', label: 'Desplazamiento observado', description: 'Describe lo observado.' },
    { code: 'development', label: 'Desarrollo observado', description: 'Describe lo observado.' },
  ],
};
const row = {
  id: 'e1',
  kind: 'maternal',
  animal: mother,
  mother,
  father: null,
  birth_event_id: 'b1',
  birth_date: '2024-06-01',
  birth_replaced: false,
  date: '2024-06-02',
  evaluated_by: 'Persona evaluadora',
  recorded_by: 'Cristopher',
  findings: maternal.criteria.map((c, i) => ({
    ...c,
    observation: i === 0 ? 'Acercamiento observado.' : null,
  })),
  notes: null,
};
const page = (items: unknown[] = []) => ({ items, total: items.length, offset: 0, limit: 25 });
describe('Maternal and offspring assessments', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read', 'breeding:write'];
    await TestBed.configureTestingModule({
      imports: [AssessmentList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions, name: 'Cristopher' }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function open() {
    const f = TestBed.createComponent(AssessmentList);
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/assessments')).flush(page([row]));
    return { f, h };
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input'));
    f.detectChanges();
  }
  async function form() {
    const { f, h } = open();
    f.nativeElement.querySelector('[data-new-assessment]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/criteria')).flush(maternal);
    h.expectOne((r) => r.url.endsWith('/birth-options')).flush(
      page([
        birth,
        {
          ...birth,
          id: 'b2',
          offspring: [{ animal: { ...child, id: 'c2', name: 'Otra cría' }, alive_at_birth: true }],
        },
      ]),
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#assessment-acceptance');
      })
      .not.toBeNull();
    fill(f, 'assessment-birth', 'b1');
    return { f, h };
  }
  it('does not expose assessments with only animal access and hides writing for breeding readers', async () => {
    permissions = ['animals:read'];
    const denied = TestBed.createComponent(AssessmentList);
    denied.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/assessments'));
    expect(denied.nativeElement.textContent).toContain('No tienes permiso');
    denied.destroy();
    permissions = ['breeding:read'];
    const { f } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    expect(f.nativeElement.querySelector('[data-new-assessment]')).toBeNull();
  });
  it('requires observations and records maternal findings for the selected birth', async () => {
    const { f, h } = await form();
    fill(f, 'assessment-date', '2024-06-02');
    fill(f, 'assessment-evaluator', 'Evaluadora responsable');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    h.expectNone((r) => r.method === 'POST');
    fill(f, 'assessment-acceptance', '  Acercamiento observado  ');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({
      birth_event_id: 'b1',
      kind: 'maternal',
      offspring_id: null,
      date: '2024-06-02',
      evaluated_by: 'Evaluadora responsable',
      findings: { acceptance: 'Acercamiento observado', nursing: null, care: null },
      notes: null,
      rubric_version: 'breeding_descriptive_v1',
    });
    req.flush(row);
    await expect
      .poll(() => {
        f.detectChanges();
        h.match((r) => r.url.endsWith('/assessments')).forEach((r) => r.flush(page([row])));
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Acercamiento observado.');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('Sin evaluar');
  });
  it('limits the offspring selector to the birth and clears it when the birth changes', async () => {
    const { f, h } = await form();
    fill(f, 'assessment-kind', 'offspring');
    h.expectOne((r) => r.url.endsWith('/criteria')).flush(offspring);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#assessment-body_features');
      })
      .not.toBeNull();
    fill(f, 'assessment-offspring', 'c1');
    fill(f, 'assessment-birth', 'b2');
    expect(f.nativeElement.querySelector('#assessment-offspring').value).toBe('');
    expect(f.nativeElement.querySelector('#assessment-offspring').textContent).toContain(
      'Otra cría',
    );
    expect(f.nativeElement.querySelector('#assessment-offspring').textContent).not.toContain(
      'Estrella',
    );
    fill(f, 'assessment-offspring', 'c2');
    fill(f, 'assessment-date', '2024-06-02');
    fill(f, 'assessment-body_features', 'Descripción observada.');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.method === 'POST');
    expect(req.request.body.offspring_id).toBe('c2');
    expect(req.request.body.findings).toEqual({
      body_features: 'Descripción observada.',
      movement: null,
      development: null,
    });
    req.flush(
      { detail: 'Assessment offspring does not belong to birth' },
      { status: 422, statusText: 'Invalid' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Selecciona una cría del parto elegido');
    expect(f.nativeElement.querySelector('#assessment-body_features').value).toBe(
      'Descripción observada.',
    );
  });
  it('ignores a late criteria response after switching the type again', async () => {
    const { f, h } = await form();
    fill(f, 'assessment-kind', 'offspring');
    const old = h.expectOne((r) => r.url.endsWith('/criteria'));
    fill(f, 'assessment-kind', 'maternal');
    h.expectOne((r) => r.url.endsWith('/criteria')).flush(maternal);
    old.flush(offspring);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#assessment-acceptance');
      })
      .not.toBeNull();
    expect(f.nativeElement.querySelector('#assessment-body_features')).toBeNull();
  });
});
