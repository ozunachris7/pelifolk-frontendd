import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { OffspringHealth } from './offspring-health';
const row = {
  id: 'case1',
  reason: 'Hallazgo registrado de la cría',
  status: 'under_treatment',
  start_date: '2024-03-01',
  closed_date: null,
};
const page = {
  items: [row],
  total: 1,
  offset: 0,
  limit: 10,
  as_of: '2026-10-16',
  date_from: '2024-01-01',
  date_to: '2024-01-31',
};
describe('Offspring case details in reproductive performance', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read', 'health:read'];
    await TestBed.configureTestingModule({
      imports: [OffspringHealth],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function fixture() {
    const f = TestBed.createComponent(OffspringHealth);
    f.componentRef.setInput('parentId', 'p1');
    f.componentRef.setInput('animalId', 'c1');
    f.componentRef.setInput('dateFrom', '2024-01-01');
    f.componentRef.setInput('dateTo', '2024-01-31');
    f.detectChanges();
    return f;
  }
  it('requires both reproductive and health permissions', () => {
    for (const p of [['breeding:read'], ['health:read'], []]) {
      permissions = p;
      const f = fixture();
      expect(f.nativeElement.textContent.trim()).toBe('');
      TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('health-cases'));
      f.destroy();
    }
  });
  it('loads only on expansion and preserves birth-cohort filters when linking a case', async () => {
    const f = fixture();
    const h = TestBed.inject(HttpTestingController);
    h.expectNone((r) => r.url.includes('health-cases'));
    f.nativeElement.querySelector('[data-toggle-offspring-health]').click();
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/performance/p1/offspring/c1/health-cases'));
    expect(req.request.params.get('date_from')).toBe('2024-01-01');
    expect(req.request.params.get('date_to')).toBe('2024-01-31');
    req.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Hallazgo registrado de la cría');
    expect(f.nativeElement.textContent).toContain('En tratamiento');
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toContain('case_id=case1');
  });
  it('does not display a response after collapsing and permits retry after an access failure', async () => {
    const f = fixture();
    const h = TestBed.inject(HttpTestingController);
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    const old = h.expectOne((r) => r.url.includes('health-cases'));
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    old.flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .not.toContain(row.reason);
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    h.expectOne((r) => r.url.includes('health-cases')).flush(
      { detail: 'Insufficient permissions' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('No tienes permiso');
    const retry = (
      Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Reintentar'))!;
    retry.click();
    f.detectChanges();
    h.expectOne((r) => r.url.includes('health-cases')).flush({ ...page, items: [], total: 0 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Sin casos sanitarios registrados');
  });
});
