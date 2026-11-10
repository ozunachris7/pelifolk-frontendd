import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { HealthRepository } from '../infrastructure/health-repository';
import { ProductList } from './product-list';
const ingredient = { id: 1, name: 'Oxitetraciclina', product_count: 1 };
const p = {
  id: 'p1',
  name: 'Oxitetraciclina 10 %',
  product_type_id: 1,
  product_type_name: 'medicine',
  unit_id: 1,
  unit_code: 'ml',
  withdrawal_days: 10,
  active: true,
  ingredients: [ingredient],
};
const catalogs = {
  product_types: [{ id: 1, name: 'medicine' }],
  units: [{ id: 1, code: 'ml' }],
  routes: [],
};
describe('Product composition', () => {
  let http: HttpTestingController;
  let permissions = [
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
      imports: [ProductList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        HealthRepository,
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture() {
    const f = TestBed.createComponent(ProductList);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/health/products'))
      .flush({ items: [p], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain(p.name);
    return f;
  }
  function fill(f: any, id: string, value: string) {
    const el = f.nativeElement.querySelector('#' + id);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    f.detectChanges();
  }
  async function edit(f: any, options: any[] = []) {
    f.nativeElement.querySelector('button[aria-label^="Editar "]').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/health/catalogs')).flush(catalogs);
    http
      .expectOne((r) => r.url.endsWith('/health/ingredients'))
      .flush({ items: options, total: options.length, offset: 0, limit: 50 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog fieldset')?.disabled;
      })
      .toBe(false);
  }
  function submit(f: any) {
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
  }
  it('keeps existing composition even when an ingredient is outside search results', async () => {
    const f = await fixture();
    await edit(f, [{ id: 2, name: 'Otro', product_count: 0 }]);
    expect(
      f.nativeElement.querySelector('button[aria-label="Quitar Oxitetraciclina"]'),
    ).not.toBeNull();
    submit(f);
    const r = http.expectOne((r) => r.url.endsWith('/health/products/p1'));
    expect(r.request.body.ingredient_ids).toEqual([1]);
    r.flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    f.destroy();
  });
  it('creates an ingredient inline without a nested modal and selects it before saving the product', async () => {
    const f = await fixture();
    await edit(f);
    f.nativeElement.querySelector('details').open = true;
    fill(f, 'product-new-ingredient', ' Ivermectina ');
    const add = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) =>
      b.textContent.includes('Agregar y seleccionar'),
    ) as HTMLButtonElement;
    add.click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url.endsWith('/health/ingredients') && r.method === 'POST');
    expect(r.request.body).toEqual({ name: 'Ivermectina' });
    expect(f.nativeElement.querySelectorAll('dialog').length).toBe(1);
    r.flush({ id: 2, name: 'Ivermectina', product_count: 0 });
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url.endsWith('/health/ingredients') && r.method === 'GET')
            .map((r) => {
              r.flush({ items: [], total: 0, offset: 0, limit: 50 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('button[aria-label="Quitar Ivermectina"]') !== null;
      })
      .toBe(true);
    http.expectNone((r) => r.url.endsWith('/health/products/p1'));
    submit(f);
    const save = http.expectOne((r) => r.url.endsWith('/health/products/p1'));
    expect(save.request.body.ingredient_ids).toEqual([1, 2]);
    save.flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    f.destroy();
  });
  it('allows readers to see composition without editing controls', async () => {
    permissions = ['health:read'];
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('Oxitetraciclina');
    expect(f.nativeElement.querySelector('[data-testid=new-product]')).toBeNull();
    expect(f.nativeElement.querySelector('button[aria-label^="Editar "]')).toBeNull();
  });

  it('captures the optional initial price in the same product request', async () => {
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
      'finance:read',
      'finance:write',
    ];
    const f = await fixture();
    f.nativeElement.querySelector('[data-testid=new-product]').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/health/catalogs')).flush(catalogs);
    http
      .expectOne((r) => r.url.endsWith('/health/ingredients'))
      .flush({ items: [], total: 0, offset: 0, limit: 50 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog fieldset')?.disabled;
      })
      .toBe(false);
    fill(f, 'product-name', 'Producto nuevo');
    for (const select of f.nativeElement.querySelectorAll('dialog select')) {
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change'));
    }
    const checkbox = Array.from(f.nativeElement.querySelectorAll('dialog label')).find((e: any) =>
      e.textContent.includes('Registrar precio inicial'),
    ) as HTMLElement;
    (checkbox.querySelector('input') as HTMLInputElement).click();
    f.detectChanges();
    fill(f, 'product-price-date', '2024-01-01');
    fill(f, 'product-price-cost', '0.50');
    submit(f);
    const r = http.expectOne((r) => r.url.endsWith('/health/products') && r.method === 'POST');
    expect(r.request.body.initial_price).toEqual({ effective_from: '2024-01-01', cost: '0.5' });
    r.flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    f.destroy();
  });
});
