import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../../core/auth/session';
import { Product } from '../domain/health';
import { ProductPrices } from './product-prices';
const product = { id: 'p1', name: 'Oxitetraciclina 10 %', unit_code: 'ml', unit_id: 1 } as Product;
describe('Product price history', () => {
  let http: HttpTestingController;
  let permissions = ['health:read', 'finance:read', 'finance:write'];
  beforeEach(async () => {
    permissions = ['health:read', 'finance:read', 'finance:write'];
    await TestBed.configureTestingModule({
      imports: [ProductPrices],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture() {
    const f = TestBed.createComponent(ProductPrices);
    f.componentRef.setInput('product', product);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/products/p1/prices'))
      .flush({
        items: [
          { effective_from: '2099-01-01', cost: '1.00' },
          { effective_from: '2024-01-01', cost: '0.50' },
        ],
        current_price: { effective_from: '2024-01-01', cost: '0.50' },
        as_of: '2026-10-16',
        total: 2,
        offset: 0,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Programado');
    return f;
  }
  it('shows the current unit price separately from future prices', async () => {
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('0.50');
    expect(f.nativeElement.textContent).toContain('no registra un gasto pagado');
  });
  it('sends decimal unit cost and preserves input on duplicate date', async () => {
    const f = await fixture();
    const cost = f.nativeElement.querySelector('#price-cost');
    cost.value = '0.75';
    cost.dispatchEvent(new Event('input'));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    const r = http.expectOne((r) => r.method === 'POST');
    expect(r.request.body.cost).toBe('0.75');
    expect(r.request.body.expected_unit_id).toBe(1);
    r.flush(
      { detail: 'Product price already exists on date' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Ya existe un precio');
    expect(f.nativeElement.querySelector('#price-cost').value).toBe('0.75');
  });
  it('does not fetch prices without finance read permission', () => {
    permissions = ['health:read'];
    const f = TestBed.createComponent(ProductPrices);
    f.componentRef.setInput('product', product);
    f.detectChanges();
    http.expectNone((r) => r.url.endsWith('/prices'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
  });
});
