import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { PhysicalList } from './physical-list';
const animal = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const criteria = {
  version: 'descriptive_v1',
  scoring: 'descriptive',
  criteria: [
    {
      code: 'body_structure',
      label: 'Estructura corporal',
      description: 'Describe las proporciones observadas.',
    },
    { code: 'limbs_hooves', label: 'Patas y aplomos', description: 'Describe lo observado.' },
    { code: 'movement', label: 'Desplazamiento', description: 'Describe el desplazamiento.' },
    { code: 'coat_features', label: 'Capa y pelaje', description: 'Describe el pelaje.' },
  ],
};
const row = {
  id: 'e1',
  animal,
  date: '2024-01-04',
  evaluated_by: 'Evaluador del rancho',
  recorded_by: 'Cristopher Ozuna',
  rubric_version: 'descriptive_v1',
  findings: criteria.criteria.map((c, i) => ({
    ...c,
    observation: i === 0 ? 'Descripción de la estructura observada.' : null,
  })),
  notes: null,
};
const page = (items: unknown[] = []) => ({ items, total: items.length, offset: 0, limit: 25 });
describe('Descriptive physical evaluations', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['animals:read', 'animals:write'];
    await TestBed.configureTestingModule({
      imports: [PhysicalList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: Session,
          useValue: {
            user: () => ({ permissions, name: 'Cristopher', paternal_lastname: 'Ozuna' }),
          },
        },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function open() {
    const f = TestBed.createComponent(PhysicalList);
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/physical-evaluations')).flush(page([row]));
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
    f.nativeElement.querySelector('[data-new-physical]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/criteria')).flush(criteria);
    h.expectOne((r) => r.url.endsWith('/animal-options')).flush([animal]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#physical-body_structure');
      })
      .not.toBeNull();
    return { f, h };
  }
  it('makes no requests without access and shows no writing for readers', async () => {
    permissions = [];
    const denied = TestBed.createComponent(PhysicalList);
    denied.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) =>
      r.url.includes('/physical-evaluations'),
    );
    expect(denied.nativeElement.textContent).toContain('No tienes permiso');
    denied.destroy();
    permissions = ['animals:read'];
    const { f } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    expect(f.nativeElement.querySelector('[data-new-physical]')).toBeNull();
  });
  it('does not invent zero scores for unassessed criteria', async () => {
    const { f } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-physical-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-physical-row] button').click();
    f.detectChanges();
    const t = f.nativeElement.querySelector('dialog').textContent;
    expect(t).toContain('Sin evaluar');
    expect(t).toContain('Evaluada por Evaluador del rancho');
    expect(t).toContain('Capturada por Cristopher Ozuna');
    expect(f.nativeElement.querySelectorAll('[data-physical-finding]').length).toBe(4);
  });
  it('requires an observation and captures evaluator independently from recorder', async () => {
    const { f, h } = await form();
    fill(f, 'physical-animal', 'a1');
    fill(f, 'physical-date', '2024-01-04');
    fill(f, 'physical-evaluator', 'Evaluador responsable');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    h.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.textContent).toContain('describe al menos un apartado');
    fill(f, 'physical-body_structure', '  Descripción observada  ');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      date: '2024-01-04',
      evaluated_by: 'Evaluador responsable',
      findings: {
        body_structure: 'Descripción observada',
        limbs_hooves: null,
        movement: null,
        coat_features: null,
      },
      notes: null,
      rubric_version: 'descriptive_v1',
    });
    req.flush(row);
    await expect
      .poll(() => {
        f.detectChanges();
        h.match((r) => r.url.endsWith('/physical-evaluations')).forEach((r) =>
          r.flush(page([row])),
        );
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Descripción de la estructura observada.');
  });
  it('preserves entered observations when saving fails', async () => {
    const { f, h } = await form();
    fill(f, 'physical-animal', 'a1');
    fill(f, 'physical-date', '2024-01-04');
    fill(f, 'physical-movement', 'Desplazamiento observado.');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    h.expectOne((r) => r.method === 'POST').flush(
      { detail: 'Physical evaluation criteria changed; reload the form' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Los criterios cambiaron');
    expect(f.nativeElement.querySelector('#physical-movement').value).toBe(
      'Desplazamiento observado.',
    );
  });
});
