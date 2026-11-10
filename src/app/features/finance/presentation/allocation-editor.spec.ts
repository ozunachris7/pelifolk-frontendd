import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../../core/auth/session';
import { AllocationEditor } from './allocation-editor';
const expense = {
  id: 'e1',
  amount: '100.01',
  date: '2024-06-01',
  description: 'Gasto sanitario',
  category: { id: 1, name: 'Sanidad' },
  supplier: null,
  sale: null,
};
const targets = [
  { id: 'a1', name: 'Luna', siniiga: 'MX1' },
  { id: 'a2', name: 'Sol', siniiga: 'MX2' },
  { id: 'a3', name: 'Canela', siniiga: 'MX3' },
];
describe('Expense allocation editor', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['finance:read', 'finance:write'];
    await TestBed.configureTestingModule({
      imports: [AllocationEditor],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(AllocationEditor);
    f.componentRef.setInput('expense', expense);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url.endsWith('/expenses/e1/allocations'))
      .flush({ expense, allocations: [], assigned_amount: '0.00', unassigned_amount: '100.01' });
    if (permissions.includes('finance:write'))
      http.expectOne((r) => r.url.endsWith('/allocation-options')).flush(targets);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Gasto general');
    return f;
  }
  function add(f: any, id: string, pct: string) {
    for (const [selector, value] of [
      ['#allocation-target', id],
      ['#allocation-percentage', pct],
    ]) {
      const e = f.nativeElement.querySelector(selector);
      e.value = value;
      e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    ([...f.nativeElement.querySelectorAll('button')] as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Agregar destino'))!
      .click();
    f.detectChanges();
  }
  it('conserves cents across a three-way split and saves only destination percentages', async () => {
    const f = await fixture();
    add(f, 'a1', '33.33');
    add(f, 'a2', '33.33');
    add(f, 'a3', '33.34');
    expect(f.nativeElement.querySelectorAll('[data-allocation-row]').length).toBe(3);
    expect(f.nativeElement.textContent).toContain('33.35');
    expect(f.nativeElement.textContent).toContain('100.00 %');
    ([...f.nativeElement.querySelectorAll('button')] as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Guardar asignación'))!
      .click();
    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'PUT');
    expect(req.request.body.allocations).toEqual(
      targets.map((t, i) => ({
        kind: 'animal',
        target_id: t.id,
        percentage: i === 2 ? '33.34' : '33.33',
      })),
    );
    req.flush({});
  });
  it('prevents incomplete splits and duplicate destinations', async () => {
    const f = await fixture();
    add(f, 'a1', '50');
    const save = ([...f.nativeElement.querySelectorAll('button')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('Guardar asignación'),
    )!;
    expect(save.disabled).toBe(true);
    add(f, 'a1', '50');
    expect(f.nativeElement.querySelectorAll('[data-allocation-row]').length).toBe(1);
    expect(f.nativeElement.textContent).toContain('Este destino ya está');
    TestBed.inject(HttpTestingController).expectNone((r) => r.method === 'PUT');
  });
  it('allows read-only inspection without exposing write controls', async () => {
    permissions = ['finance:read'];
    const f = await fixture();
    expect(f.nativeElement.textContent).not.toContain('Guardar asignación');
    expect(f.nativeElement.querySelector('#allocation-target')).toBeNull();
  });
});
