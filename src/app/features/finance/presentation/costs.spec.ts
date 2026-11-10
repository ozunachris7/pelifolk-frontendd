import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Costs } from './costs';
const target = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const page = {
  as_of: '2026-10-14',
  kind: 'animal',
  target,
  date_from: null,
  date_to: null,
  total: 1,
  assigned_expenses: '120.00',
  feeding: { total: 1, unpriced_count: 0, total_cost: '20.00' },
  offset: 0,
  limit: 25,
  items: [
    {
      expense_id: 'e1',
      allocation_id: 's1',
      date: '2024-06-01',
      category: { id: 1, name: 'veterinary' },
      description: 'Atención sanitaria',
      expense_amount: '240.00',
      percentage: '50.00',
      amount: '120.00',
      via: 'animal',
    },
  ],
};
describe('Assigned costs', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['finance:read'];
    await TestBed.configureTestingModule({
      imports: [Costs],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(Costs);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/allocation-options'))
      .flush([target]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#cost-target option[value=a1]');
      })
      .toBeTruthy();
    return f;
  }
  async function load(f: any, response = page) {
    const e = f.nativeElement.querySelector('#cost-target');
    e.value = 'a1';
    e.dispatchEvent(new Event('change', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/finance/costs'))
      .flush(response);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Gastos registrados asignados');
  }
  it('shows accounting expense and feeding costs separately rather than adding them', async () => {
    const f = await fixture();
    await load(f);
    expect(f.nativeElement.querySelector('[data-testid=assigned-cost]').textContent).toContain(
      '120.00',
    );
    expect(f.nativeElement.querySelector('[data-testid=feeding-cost]').textContent).toContain(
      '20.00',
    );
    expect(f.nativeElement.textContent).not.toContain('140.00');
  });
  it('respects missing feeding permission and supports inspection of the original expense', async () => {
    const f = await fixture();
    await load(f, { ...page, feeding: null } as any);
    expect(f.nativeElement.querySelector('[data-testid=feeding-cost]')).toBeNull();
    ([...f.nativeElement.querySelectorAll('button')] as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Ver asignación'))!
      .click();
    f.detectChanges();
    const req = TestBed.inject(HttpTestingController).expectOne((r) =>
      r.url.endsWith('/expenses/e1/allocations'),
    );
    req.flush({
      expense: {
        id: 'e1',
        amount: '240.00',
        date: '2024-06-01',
        description: 'Atención sanitaria',
      },
      allocations: [],
      assigned_amount: '0.00',
      unassigned_amount: '240.00',
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-allocation-editor')?.textContent;
      })
      .toContain('240.00');
  });
  it('does not read without permission', () => {
    permissions = [];
    const f = TestBed.createComponent(Costs);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
