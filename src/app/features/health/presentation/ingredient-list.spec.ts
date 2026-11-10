import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { HealthRepository } from '../infrastructure/health-repository';
import { IngredientList } from './ingredient-list';
const row = { id: 1, name: 'Oxitetraciclina', product_count: 1 };
describe('Ingredient catalog', () => {
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
      imports: [IngredientList],
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
  async function fixture(items = [row]) {
    const f = TestBed.createComponent(IngredientList);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/health/ingredients'))
      .flush({ items, total: items.length, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('principios activos');
    return f;
  }
  it('blocks removal of assigned ingredients and supports readers', async () => {
    const f = await fixture();
    expect(
      f.nativeElement.querySelector('button[aria-label="Eliminar Oxitetraciclina"]').disabled,
    ).toBe(true);
    f.destroy();
    permissions = ['health:read'];
    const reader = await fixture();
    expect(reader.nativeElement.querySelector('[data-new-ingredient]')).toBeNull();
    expect(reader.nativeElement.querySelector('button[aria-label^="Editar "]')).toBeNull();
  });
  it('trims names and retains edits on duplicate-name conflict', async () => {
    const f = await fixture();
    f.nativeElement.querySelector('button[aria-label="Editar Oxitetraciclina"]').click();
    f.detectChanges();
    const input = f.nativeElement.querySelector('#ingredient-name');
    input.value = ' Ivermectina ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const r = http.expectOne((r) => r.url.endsWith('/health/ingredients/1'));
    expect(r.request.body).toEqual({ name: 'Ivermectina' });
    r.flush(
      { detail: 'Active ingredient already exists' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog [role=alert]')?.textContent;
      })
      .toContain('Ya existe un principio activo');
    expect(f.nativeElement.querySelector('#ingredient-name').value).toBe(' Ivermectina ');
  });
  it('requires confirmation and preserves the catalog if a concurrent assignment prevents deletion', async () => {
    const f = await fixture([{ ...row, product_count: 0 }]);
    f.nativeElement.querySelector('button[aria-label="Eliminar Oxitetraciclina"]').click();
    f.detectChanges();
    http.expectNone((r) => r.method === 'DELETE');
    const button = Array.from(f.nativeElement.querySelectorAll('dialog button')).find(
      (b: any) => b.textContent.trim() === 'Eliminar',
    ) as HTMLButtonElement;
    button.click();
    const r = http.expectOne(
      (r) => r.url.endsWith('/health/ingredients/1') && r.method === 'DELETE',
    );
    r.flush(
      { detail: 'Active ingredient is assigned to products' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog [role=alert]')?.textContent;
      })
      .toContain('está asignado a productos');
    expect(f.nativeElement.querySelector('[data-ingredient="1"]')).not.toBeNull();
  });
});
