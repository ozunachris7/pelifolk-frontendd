import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../../core/auth/session';
import { Treatment } from '../domain/health';
import { TreatmentCost } from './treatment-cost';
const treatment = { id: 't1', product: { id: 'p1' } } as Treatment;
const data = {
  known_cost: '1.00',
  priced_applications: 1,
  unknown_applications: 1,
  total: 2,
  offset: 0,
  status: 'partial',
  items: [
    {
      dose_id: 'd1',
      date: '2024-01-03',
      quantity: '2',
      unit_code: 'ml',
      unit_cost: '0.50',
      cost: '1.00',
      effective_from: '2024-01-01',
      unknown_reason: null,
    },
    {
      dose_id: 'd2',
      date: '2024-01-04',
      quantity: '2',
      unit_code: 'g',
      unit_cost: null,
      cost: null,
      effective_from: null,
      unknown_reason: 'unit_mismatch',
    },
  ],
};
describe('Calculated application cost', () => {
  let http: HttpTestingController;
  let permissions = ['health:read', 'finance:read'];
  beforeEach(async () => {
    permissions = ['health:read', 'finance:read'];
    await TestBed.configureTestingModule({
      imports: [TreatmentCost],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads lazily, labels partial costs and refreshes after an application is added', async () => {
    const f = TestBed.createComponent(TreatmentCost);
    f.componentRef.setInput('treatment', treatment);
    f.detectChanges();
    http.expectNone((r) => r.url.endsWith('/cost'));
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/cost')).flush(data);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Subtotal conocido');
    expect(f.nativeElement.textContent).toContain('Unidad de aplicación distinta');
    f.componentRef.setInput('revision', 1);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/cost')).flush({ ...data, known_cost: '2.00' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('2.00');
  });
  it('hides cost controls without finance read', () => {
    permissions = ['health:read'];
    const f = TestBed.createComponent(TreatmentCost);
    f.componentRef.setInput('treatment', treatment);
    f.detectChanges();
    expect(f.nativeElement.querySelector('button')).toBeNull();
    http.expectNone((r) => r.url.endsWith('/cost'));
  });
});
