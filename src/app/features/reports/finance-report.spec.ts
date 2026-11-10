import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/auth/session';
import { API_URL } from '../../core/http/api-url';
import { FinanceReport } from './finance-report';
import { ReportHome } from './report-home';
const page = {
  as_of: '2026-10-10',
  date_from: '2024-06-01',
  date_to: '2024-06-02',
  kind: 'expense',
  items: [],
  total: 0,
  filtered_total: '0.00',
  summary: {
    income_total: '300.30',
    expense_total: '170.15',
    balance: '130.15',
    income_count: 1,
    expense_count: 3,
  },
  offset: 0,
  limit: 25,
};
describe('Finance report', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceReport, ReportHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: ['finance:read'] }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(FinanceReport);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/finance/options`)
      .flush({
        expense_categories: [{ id: 1, name: 'feed' }],
        income_categories: [],
        suppliers: [{ id: 's1', name: 'Agropecuaria', active: false }],
      });
    http.expectOne((r) => r.url === `${url}/reports/finance`).flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 gastos');
    return f;
  }
  it('keeps dates and clears expense-only filters when switching to income', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    for (const [id, value] of [
      ['finance-report-from', '2024-06-01'],
      ['finance-report-to', '2024-06-02'],
      ['finance-report-supplier', 's1'],
      ['finance-report-category', '1'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    f.nativeElement.querySelector('[data-finance-tab=income]').click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url === `${url}/reports/finance`);
    expect(r.request.params.get('kind')).toBe('income');
    expect(r.request.params.get('date_from')).toBe('2024-06-01');
    expect(r.request.params.has('supplier_id')).toBe(false);
    expect(r.request.params.has('category_id')).toBe(false);
    r.flush({ ...page, kind: 'income' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('0 ingresos');
  });
  it('exports the applied filters while retaining the period balance', async () => {
    const f = await fixture();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const input = f.nativeElement.querySelector('#finance-report-q');
    input.value = 'Compra';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/reports/finance`);
    expect(req.request.params.get('q')).toBe('Compra');
    req.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[data-testid=finance-period-summary]');
      })
      .toBe(true);
    input.value = 'Otro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Descargar Excel'))!
      .click();
    const x = http.expectOne((r) => r.url === `${url}/reports/finance/export`);
    expect(x.request.params.get('q')).toBe('Compra');
    x.flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('opens only economy with finance read permission', () => {
    const f = TestBed.createComponent(ReportHome);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-finance-report')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-animal-report')).toBeNull();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/reports/finance/options`)
      .flush({ expense_categories: [], income_categories: [], suppliers: [] });
    http.expectOne((r) => r.url === `${url}/reports/finance`).flush(page);
  });
});
