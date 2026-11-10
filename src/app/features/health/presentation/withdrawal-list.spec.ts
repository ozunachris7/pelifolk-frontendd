import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { WithdrawalList } from './withdrawal-list';
const row = {
  animal: { id: 'a1', name: 'Luna', siniiga: 'MX1' },
  status: 'unknown',
  release_date: null,
  treatment_count: 1,
  unknown_count: 1,
  in_treatment: false,
};
describe('Health withdrawals', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['health:read'];
    await TestBed.configureTestingModule({
      imports: [WithdrawalList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('shows unknown historical periods and the recorded treatment detail', async () => {
    const f = TestBed.createComponent(WithdrawalList);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url.endsWith('/health/withdrawals'))
      .flush({ items: [row], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Periodo por verificar');
    f.nativeElement.querySelector('tbody button').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/animals/a1/withdrawal'))
      .flush({
        ...row,
        items: [
          {
            event_id: 't1',
            product_name: 'Producto registrado',
            start_date: '2024-01-03',
            last_day: '2024-01-05',
            withdrawal_days: null,
            release_date: null,
            status: 'unknown',
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Periodo guardado: Por verificar');
  });
  it('makes no health requests without permission', () => {
    permissions = [];
    const f = TestBed.createComponent(WithdrawalList);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/health/'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
  });
  it('shows the last actual application with its recorded timezone and calculated date', async () => {
    const f = TestBed.createComponent(WithdrawalList);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const actual = {
      ...row,
      status: 'pending',
      release_date: '2026-10-22',
      unknown_count: 0,
      application_count: 2,
      missing_applications_count: 0,
    };
    http
      .expectOne((r) => r.url.endsWith('/health/withdrawals'))
      .flush({ items: [actual], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Dosis registradas: 2');
    f.nativeElement.querySelector('tbody button').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/animals/a1/withdrawal'))
      .flush({
        ...actual,
        items: [
          {
            event_id: 't1',
            product_id: 'p1',
            product_name: 'Producto registrado',
            start_date: '2026-10-13',
            last_day: '2026-10-15',
            withdrawal_days: 7,
            release_date: '2026-10-22',
            estimated_release_date: '2026-10-22',
            planned_release_date: '2026-10-23',
            last_applied_at: '2026-10-14T23:30:00-06:00',
            application_count: 2,
            calculation_basis: 'applications',
            review_reasons: [],
            status: 'pending',
            in_treatment: false,
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('14/10/2026 23:30 (UTC-06:00)');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('22/10/2026');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('Último día previsto');
  });
  it('keeps the planned date as a reference when applications are missing', async () => {
    const f = TestBed.createComponent(WithdrawalList);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url.endsWith('/health/withdrawals'))
      .flush({
        items: [{ ...row, application_count: 0, missing_applications_count: 1 }],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Sin dosis: 1');
    f.nativeElement.querySelector('tbody button').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/animals/a1/withdrawal'))
      .flush({
        ...row,
        items: [
          {
            event_id: 't1',
            product_name: 'Producto registrado',
            start_date: '2024-01-03',
            last_day: '2024-01-05',
            withdrawal_days: 7,
            release_date: null,
            last_applied_at: null,
            application_count: 0,
            planned_release_date: '2024-01-13',
            review_reasons: ['missing_applications'],
            status: 'unknown',
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Referencia de pauta: 13/01/2024');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain(
      'No confirma aplicaciones realizadas',
    );
    expect(f.nativeElement.querySelector('dialog').textContent).toContain(
      'Sin dosis aplicadas registradas',
    );
  });
  it('does not show an animal clearance date while records require review', async () => {
    const f = TestBed.createComponent(WithdrawalList);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url.endsWith('/health/withdrawals'))
      .flush({
        items: [{ ...row, release_date: '2026-10-22', application_count: 1 }],
        total: 1,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Periodo por verificar');
    expect(f.nativeElement.querySelector('tbody').textContent).not.toContain('22/10/2026');
  });
});
