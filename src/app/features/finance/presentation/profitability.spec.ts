import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Profitability } from './profitability';
const row = {
  animal: { id: 'a1', name: 'Luna', siniiga: 'MX1' },
  status: 'active',
  income: '200.00',
  income_count: 1,
  expenses: '100.00',
  expense_count: 1,
  direct_expenses: '50.00',
  case_expenses: '0.00',
  group_expenses: '50.00',
  result: '100.00',
  feeding: { known_cost: '20.00', direct: '20.00', group: '0.00', records: 1, unpriced: 0 },
  medicines: { known_cost: '1.00', applications: 1, unpriced: 0 },
};
const page = {
  as_of: '2026-10-16',
  items: [row],
  total: 1,
  offset: 0,
  limit: 25,
  summary: { income: '200.00', expenses: '100.00', result: '100.00' },
  coverage: {
    pending_expenses: '120.00',
    pending_expense_count: 1,
    pending_income: '50.00',
    pending_income_count: 1,
    status: 'pending_attribution',
  },
};
describe('Attributed animal result', () => {
  let http: HttpTestingController;
  let permissions = ['finance:read'];
  beforeEach(async () => {
    permissions = ['finance:read'];
    await TestBed.configureTestingModule({
      imports: [Profitability],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture() {
    const f = TestBed.createComponent(Profitability);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/profitability')).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-profit-row]')?.textContent;
      })
      .toContain('Luna');
    return f;
  }
  it('shows only recorded ledger result and keeps use values out of the result', async () => {
    const f = await fixture();
    expect(f.nativeElement.querySelector('[data-profit-result]').textContent).toContain('100.00');
    expect(f.nativeElement.querySelector('[data-profit-result]').textContent).not.toContain(
      '79.00',
    );
    expect(f.nativeElement.textContent).toContain('resultados por animal son parciales');
  });
  it('loads original entries on demand and separates reference sections', async () => {
    const f = await fixture();
    http.expectNone((r) => r.url.includes('/entries'));
    f.nativeElement.querySelector('button[aria-label^="Ver resultado de"]').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/a1/entries') && r.params.get('section') === 'incomes')
      .flush({
        items: [
          {
            id: 'i1',
            date: '2024-06-01',
            title: 'Ingreso vinculado',
            amount: '200.00',
            via: 'direct',
          },
        ],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('Ingreso vinculado');
    expect(f.nativeElement.querySelector('app-detail-page, dialog').textContent).toContain(
      'fuera de la suma anterior',
    );
  });
  it('loads global pending incomes with a link to edit the exact record', async () => {
    const f = await fixture();
    const tab = Array.from(f.nativeElement.querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Ingresos sin animal',
    ) as HTMLButtonElement;
    tab.click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/profitability')).flush(page);
    http
      .expectOne((r) => r.url.endsWith('/pending') && r.params.get('kind') === 'incomes')
      .flush({
        items: [
          {
            id: 'i1',
            date: '2024-06-01',
            amount: '50.00',
            description: 'Ingreso pendiente',
            record: { id: 'i1' },
          },
        ],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement
          .querySelector('a[aria-label="Ver ingreso en Economía"]')
          ?.getAttribute('href');
      })
      .toContain('income_id=i1');
  });
  it('queries the selected ID and announces no financial activity', async () => {
    const f = await fixture();
    (f.componentInstance as any).chooseAnimal(row.animal);
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const req = http.expectOne(
      (r) => r.url.endsWith('/profitability') && r.params.get('animal_id') === 'a1',
    );
    expect(req.request.params.has('q')).toBe(false);
    req.flush({
      ...page,
      activity: { income_count: 0, expense_count: 0 },
      items: [{ ...row, income_count: 0, expense_count: 0 }],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('No hay ingresos ni gastos atribuidos');
  });
  it('announces an empty filtered list', async () => {
    const f = TestBed.createComponent(Profitability);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/profitability')).flush({ ...page, total: 0, items: [] });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('No hay animales con los filtros seleccionados');
  });
  it('denies reading without permission', () => {
    permissions = [];
    const f = TestBed.createComponent(Profitability);
    f.detectChanges();
    http.expectNone((r) => r.url.endsWith('/profitability'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
  });
});
