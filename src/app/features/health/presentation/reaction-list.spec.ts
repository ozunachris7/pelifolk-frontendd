import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { ReactionList } from './reaction-list';
const animal = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const row = {
  id: 'r1',
  animal,
  date: '2024-01-05',
  kind: 'adverse_reaction',
  description: 'Hallazgo observado, causa sin confirmar.',
  suspected_agent: null,
  product_id: 'p1',
  product_name: 'Producto registrado',
  dose: null,
  recorded_by: 'Cristopher Ozuna',
  status: 'open',
  closed_date: null,
  closure_notes: null,
  closed_by: null,
};
const page = (items: unknown[] = []) => ({ items, total: items.length, offset: 0, limit: 25 });
describe('Allergies and reactions', () => {
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
      imports: [ReactionList],
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
    const f = TestBed.createComponent(ReactionList);
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/health/reactions')).flush(page([row]));
    return { f, h };
  }
  it('makes no health requests without read access and hides writing for readers', async () => {
    permissions = [];
    const f = TestBed.createComponent(ReactionList);
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectNone((r) => r.url.includes('/health/'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    f.destroy();
    permissions = ['health:read'];
    const { f: g } = open();
    await expect
      .poll(() => {
        g.detectChanges();
        return g.nativeElement.textContent;
      })
      .toContain('Luna');
    expect(g.nativeElement.querySelector('[data-new-reaction]')).toBeNull();
    g.nativeElement.querySelector('[data-reaction-row] button').click();
    g.detectChanges();
    expect(g.nativeElement.textContent).not.toContain('Cerrar seguimiento');
  });
  it('creates an observation with no product or dose without inventing associations', async () => {
    const { f, h } = open();
    f.nativeElement.querySelector('[data-new-reaction]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/health/animal-options')).flush([animal]);
    h.expectOne((r) => r.url.endsWith('/health/products')).flush(page());
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#reaction-animal')?.options.length;
      })
      .toBe(2);
    function fill(id: string, value: string) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input'));
      f.detectChanges();
    }
    fill('reaction-animal', 'a1');
    h.expectOne((r) => r.url.endsWith('/reactions/dose-options')).flush(page());
    fill('reaction-date', '2024-01-05');
    fill('reaction-description', '  Hallazgo observado  ');
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/health/reactions') && r.method === 'POST');
    expect(req.request.body).toEqual({
      animal_id: 'a1',
      date: '2024-01-05',
      kind: 'adverse_reaction',
      description: 'Hallazgo observado',
      suspected_agent: null,
      product_id: null,
      dose_id: null,
    });
    // Failure preserves the form so the user can retry without losing the report.
    req.flush({ detail: 'Product not found' }, { status: 422, statusText: 'Invalid' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El producto ya no está disponible');
    expect(f.nativeElement.querySelector('#reaction-description').value).toBe(
      '  Hallazgo observado  ',
    );
  });
  it('shows original report and records a closure without changing its description', async () => {
    const { f, h } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-reaction-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-reaction-row] button').click();
    f.detectChanges();
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('dialog button'),
    ) as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Cerrar seguimiento'))!.click();
    f.detectChanges();
    for (const [id, value] of [
      ['reaction-close-date', '2024-01-06'],
      ['reaction-close-notes', 'Se concluyó el seguimiento.'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event('input'));
    }
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/reactions/r1/closure'));
    expect(req.request.body).toEqual({ date: '2024-01-06', notes: 'Se concluyó el seguimiento.' });
    req.flush({
      ...row,
      status: 'closed',
      closed_date: '2024-01-06',
      closure_notes: 'Se concluyó el seguimiento.',
      closed_by: 'Cristopher Ozuna',
    });
    await expect
      .poll(() => {
        f.detectChanges();
        h.match((r) => r.url.endsWith('/health/reactions')).forEach((r) => r.flush(page()));
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Seguimiento cerrado');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain(row.description);
    expect(f.nativeElement.querySelector('dialog').textContent).toContain(
      'El cierre no descarta una alergia',
    );
  });
  it('clears selected dose when animal changes and ignores late responses', async () => {
    const { f, h } = open();
    f.nativeElement.querySelector('[data-new-reaction]').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/health/animal-options')).flush([
      animal,
      { ...animal, id: 'a2', name: 'Estrella' },
    ]);
    h.expectOne((r) => r.url.endsWith('/health/products')).flush(page());
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#reaction-animal')?.options.length;
      })
      .toBe(3);
    const a = f.nativeElement.querySelector('#reaction-animal');
    a.value = 'a1';
    a.dispatchEvent(new Event('change'));
    f.detectChanges();
    const old = h.expectOne((r) => r.url.endsWith('/reactions/dose-options'));
    a.value = 'a2';
    a.dispatchEvent(new Event('change'));
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/reactions/dose-options')).flush(page());
    old.flush(
      page([
        { id: 'wrong', product_name: 'Dosis de Luna', applied_at: '2024-01-03T10:00:00-06:00' },
      ]),
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#reaction-dose')?.options.length;
      })
      .toBe(1);
    expect(f.nativeElement.textContent).not.toContain('Dosis de Luna');
  });
});
