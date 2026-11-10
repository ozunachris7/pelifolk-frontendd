import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session, SessionUser } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { FinanceRepository } from '../infrastructure/finance-repository';
import { FinanceList } from './finance-list';
const USER: SessionUser = {
  id: 'owner',
  name: 'Cris',
  middle_name: null,
  paternal_lastname: 'Ozuna',
  maternal_lastname: 'Vazquez',
  email: 'owner@example.com',
  phone: null,
  active: true,
  role_id: 'owner-role',
  role_name: 'owner',
  permissions: ['finance:read', 'finance:write'],
};
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<FinanceList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<FinanceList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<FinanceList>, id: string, value: string) {
  const el = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, 'Test-password123');
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await pending;
}

const SUPPLIER = {
  id: 'p1',
  name: 'Agropecuaria del Valle',
  phone: null,
  email: null,
  address: null,
  active: true,
};
const EXPENSE_CATEGORY = { id: 1, name: 'feed' };
const INCOME_CATEGORY = { id: 1, name: 'animal_sales' };
const SALE = {
  id: 's1',
  animal_id: 'a1',
  animal_name: 'Aurora',
  siniiga: null,
  date: '2024-06-01',
};
const TOTALS = {
  income_total: '0.00',
  expense_total: '150.25',
  balance: '-150.25',
  income_count: 0,
  expense_count: 1,
};
function flushCategories() {
  http.expectOne(`${api}/finance/categories/expense`).flush([EXPENSE_CATEGORY]);
  http.expectOne(`${api}/finance/categories/income`).flush([INCOME_CATEGORY]);
}
async function flushMoney(
  f: ComponentFixture<FinanceList>,
  kind = 'expenses',
  items: unknown[] = [],
) {
  flushCategories();
  await expect
    .poll(
      () =>
        http
          .match((r) => r.url === `${api}/finance/${kind}`)
          .map((r) => {
            r.flush({ items, total: items.length, offset: 0, limit: 25 });
            return true;
          }).length,
    )
    .toBe(1);
  http.expectOne((r) => r.url === `${api}/finance/summary`).flush(TOTALS);
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).textContent?.includes('Cargando Economía');
    })
    .toBe(false);
}
async function fixture() {
  const f = TestBed.createComponent(FinanceList);
  f.detectChanges();
  await flushMoney(f);
  return f;
}
function submit(f: ComponentFixture<FinanceList>) {
  element(f)
    .querySelector('dialog form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
function categorySelect(f: ComponentFixture<FinanceList>) {
  const el = element(f).querySelector<HTMLSelectElement>('#money-category')!;
  el.selectedIndex = 1;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  f.detectChanges();
}
describe('Finance', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('pelifolk-session');
    await TestBed.configureTestingModule({
      imports: [FinanceList],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        FinanceRepository,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('pelifolk-session');
  });
  it('respects read and write permissions', async () => {
    await login([]);
    const denied = TestBed.createComponent(FinanceList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes('/finance'));
    expect(element(denied).textContent).toContain('No tienes permiso');
    denied.destroy();
    await login(['finance:read']);
    const f = await fixture();
    expect(element(f).querySelector('[data-testid=new-finance]')).toBeNull();
  });
  it('saves an expense with its supplier and precise amount', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-testid=new-finance]');
    http
      .expectOne((r) => r.url === `${api}/finance/suppliers`)
      .flush({ items: [SUPPLIER], total: 1, offset: 0, limit: 100 });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#money-supplier')?.options.length;
      })
      .toBe(2);
    categorySelect(f);
    fill(f, 'money-amount', '150.25');
    fill(f, 'money-date', '2024-06-01');
    fill(f, 'money-supplier', 'p1');
    fill(f, 'money-description', ' Alimento para el hato ');
    submit(f);
    const req = http.expectOne(`${api}/finance/expenses`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      category_id: 1,
      amount: '150.25',
      date: '2024-06-01',
      supplier_id: 'p1',
      description: 'Alimento para el hato',
    });
    const saved = {
      id: 'e1',
      category: EXPENSE_CATEGORY,
      amount: '150.25',
      date: '2024-06-01',
      supplier: SUPPLIER,
      sale: null,
      description: 'Alimento para el hato',
    };
    req.flush(saved);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/finance/categories/expense`)
            .map((r) => {
              r.flush([EXPENSE_CATEGORY]);
              return true;
            }).length,
      )
      .toBe(1);
    http.expectOne(`${api}/finance/categories/income`).flush([INCOME_CATEGORY]);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/finance/expenses`)
            .map((r) => {
              r.flush({ items: [saved], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    http.expectOne(`${api}/finance/summary`).flush(TOTALS);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('dialog')?.textContent;
      })
      .toContain('Agropecuaria del Valle');
  });
  it('links an income to a sale and keeps the form when the sale already has an income', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-tab=incomes]');
    await flushMoney(f, 'incomes');
    click(f, '[data-testid=new-finance]');
    http.expectOne((r) => r.url === `${api}/finance/sale-options`).flush([SALE]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#money-sale')?.options.length;
      })
      .toBe(2);
    categorySelect(f);
    fill(f, 'money-amount', '1800');
    fill(f, 'money-date', '2024-06-01');
    fill(f, 'money-sale', 's1');
    submit(f);
    const req = http.expectOne(`${api}/finance/incomes`);
    expect(req.request.body).toEqual({
      category_id: 1,
      amount: '1800',
      date: '2024-06-01',
      description: null,
      exit_event_id: 's1',
    });
    req.flush({ detail: 'Sale already has an income' }, { status: 409, statusText: 'Conflict' });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[role=alert]')?.textContent;
      })
      .toContain('ya tiene un ingreso');
    expect(element(f).querySelector<HTMLSelectElement>('#money-sale')?.value).toBe('s1');
  });
  it('deactivates a supplier while retaining its contact details', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-tab=suppliers]');
    flushCategories();
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/finance/suppliers`)
            .map((r) => {
              r.flush({ items: [SUPPLIER], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector('[data-supplier-id]');
      })
      .toBe(true);
    click(f, 'button[aria-label^="Editar proveedor"]');
    click(f, '#supplier-active');
    submit(f);
    const req = http.expectOne(`${api}/finance/suppliers/p1`);
    expect(req.request.body).toEqual({
      name: SUPPLIER.name,
      phone: null,
      email: null,
      address: null,
      active: false,
    });
    req.flush({ ...SUPPLIER, active: false });
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/finance/categories/expense`)
            .map((r) => {
              r.flush([EXPENSE_CATEGORY]);
              return true;
            }).length,
      )
      .toBe(1);
    http.expectOne(`${api}/finance/categories/income`).flush([INCOME_CATEGORY]);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/finance/suppliers`)
            .map((r) => {
              r.flush({ items: [{ ...SUPPLIER, active: false }], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('[data-supplier-id]')?.textContent;
      })
      .toContain('Inactivo');
  });

  async function kilogramForm() {
    await login();
    const f = await fixture();
    click(f, '[data-tab=incomes]');
    await flushMoney(f, 'incomes');
    click(f, '[data-testid=new-finance]');
    http
      .expectOne((r) => r.url === `${api}/finance/sale-options`)
      .flush([SALE, { ...SALE, id: 's2', animal_name: 'Lucero' }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#money-sale')?.options.length;
      })
      .toBe(3);
    categorySelect(f);
    fill(f, 'money-date', '2024-06-01');
    fill(f, 'money-pricing', 'per_kg');
    fill(f, 'money-sale', 's1');
    return f;
  }
  it('previews exact rounding and sends evidence for server calculation without a manual amount', async () => {
    const f = await kilogramForm();
    http
      .expectOne(`${api}/finance/sales/s1/weights`)
      .flush([{ id: 'w1', date: '2024-06-01', weight_kg: '35.25' }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#money-weight')?.options.length;
      })
      .toBe(2);
    fill(f, 'money-weight', 'w1');
    fill(f, 'money-kg-price', '65.50');
    expect(element(f).querySelector('output')?.textContent).toContain('2,308.88');
    expect(element(f).querySelector('#money-amount')).toBeNull();
    submit(f);
    const r = http.expectOne(`${api}/finance/incomes`);
    expect(r.request.body).toEqual({
      category_id: 1,
      date: '2024-06-01',
      description: null,
      exit_event_id: 's1',
      pricing_mode: 'per_kg',
      weight_event_id: 'w1',
      price_per_kg: '65.5',
    });
    r.flush({ detail: 'Sale already has an income' }, { status: 409, statusText: 'Conflict' });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('#money-kg-price') !== null;
      })
      .toBe(true);
  });
  it('ignores stale weight responses when the selected sale changes', async () => {
    const f = await kilogramForm();
    const first = http.expectOne(`${api}/finance/sales/s1/weights`);
    fill(f, 'money-sale', 's2');
    const second = http.expectOne(`${api}/finance/sales/s2/weights`);
    second.flush([{ id: 'w2', date: '2024-06-01', weight_kg: '40.00' }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('#money-weight')?.textContent;
      })
      .toContain('40.00');
    first.flush([{ id: 'w1', date: '2024-06-01', weight_kg: '35.25' }]);
    await Promise.resolve();
    f.detectChanges();
    expect(element(f).querySelector('#money-weight')?.textContent).not.toContain('35.25');
    fill(f, 'money-kg-price', '65');
    submit(f);
    http.expectNone(`${api}/finance/incomes`);
  });
  it('prevents saving without sale-day weights and restores total-price entry', async () => {
    const f = await kilogramForm();
    http.expectOne(`${api}/finance/sales/s1/weights`).flush([]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain('Si no tiene pesaje');
    fill(f, 'money-kg-price', '65');
    submit(f);
    http.expectNone(`${api}/finance/incomes`);
    fill(f, 'money-pricing', 'total');
    fill(f, 'money-amount', '2000');
    submit(f);
    const r = http.expectOne(`${api}/finance/incomes`);
    expect(r.request.body.amount).toBe('2000');
    expect(r.request.body.weight_event_id).toBeUndefined();
    r.flush({ detail: 'Sale already has an income' }, { status: 409, statusText: 'Conflict' });
  });

  it('links a non-sale income directly to one animal', async () => {
    await login();
    const f = await fixture();
    click(f, '[data-tab=incomes]');
    await flushMoney(f, 'incomes');
    click(f, '[data-testid=new-finance]');
    http.expectOne((r) => r.url === `${api}/finance/sale-options`).flush([]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector('#money-sale') !== null;
      })
      .toBe(true);
    const toggle = Array.from(element(f).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Vincular ingreso a un animal'),
    )!;
    toggle.click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/allocation-options') && r.params.get('kind') === 'animal')
      .flush([{ id: 'a1', name: 'Luna', siniiga: 'MX1' }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>('#income-animal')?.options.length;
      })
      .toBe(2);
    categorySelect(f);
    fill(f, 'money-amount', '200');
    fill(f, 'money-date', '2024-06-01');
    fill(f, 'income-animal', 'a1');
    submit(f);
    const r = http.expectOne(`${api}/finance/incomes`);
    expect(r.request.body.animal_id).toBe('a1');
    expect(r.request.body.exit_event_id).toBeNull();
    r.flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    f.destroy();
  });
});
