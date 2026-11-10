import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Performance } from './performance';
const animal = { id: 'm1', name: 'Luna', siniiga: 'MX1', sex: 'female' };
const health = {
  total_cases: 2,
  open_cases: 1,
  under_treatment_cases: 1,
  closed_cases: 0,
  offspring_with_cases: 1,
  offspring_without_cases: 1,
};
const metric = {
  animal,
  is_breeder: true,
  status: 'active',
  matings: 1,
  births: 1,
  offspring: 2,
  live_births: 2,
  stillbirths: 0,
  unknown_birth_condition: 0,
  post_birth_deaths: 0,
  in_herd: 2,
  other_exits: 0,
  weighed_offspring: 0,
  average_birth_weight_kg: null,
  weaned_offspring: 0,
  average_weaning_weight_kg: null,
  offspring_per_recorded_birth: '2.00',
  health,
};
const page = {
  as_of: '2026-10-16',
  sex: 'female',
  date_from: null,
  date_to: null,
  total: 1,
  summary: { offspring: 2, live_births: 2 },
  offset: 0,
  limit: 25,
  items: [metric],
  health_summary: health,
};
describe('Health summary within reproductive performance', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read', 'health:read'];
    await TestBed.configureTestingModule({
      imports: [Performance],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function open() {
    const f = TestBed.createComponent(Performance);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/breeding/performance'))
      .flush(page);
    return f;
  }
  it('shows affected offspring separately from case totals and exposes cases from each child', async () => {
    const f = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-offspring-health-summary]')?.textContent;
      })
      .toContain('1 con casos');
    expect(f.nativeElement.querySelector('[data-offspring-health-summary]').textContent).toContain(
      '2 casos en total',
    );
    const button =
      f.nativeElement.querySelector('[aria-label="Ver crías de Luna · MX1"]') ||
      f.nativeElement.querySelector('tbody button');
    button.click();
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/m1/offspring')).flush({
      as_of: page.as_of,
      date_from: null,
      date_to: null,
      parent: metric,
      total: 1,
      offset: 0,
      limit: 25,
      items: [
        {
          animal: { id: 'c1', name: 'Estrella', sex: 'female', siniiga: null },
          birth_date: '2024-01-01',
          born_alive: true,
          birth_weight_kg: null,
          status: 'active',
          exit_date: null,
          weaning: null,
          health: { total_cases: 2, open_cases: 1, under_treatment_cases: 1, closed_cases: 0 },
        },
      ],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('Casos sanitarios: 2');
    h.expectNone((r) => r.url.includes('health-cases'));
    expect(f.nativeElement.querySelector('[data-toggle-offspring-health]')).not.toBeNull();
  });
  it('hides all health summaries and columns without health permission even for an unexpected payload', async () => {
    permissions = ['breeding:read'];
    const f = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    expect(f.nativeElement.querySelector('[data-offspring-health-summary]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-parent-child-health]')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Casos de las crías');
  });
  it('keeps missing data distinct from a recorded zero', async () => {
    const f = TestBed.createComponent(Performance);
    f.detectChanges();
    const { health: _, ...missing } = metric;
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/breeding/performance'))
      .flush({ ...page, items: [missing], health_summary: undefined });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-parent-child-health]')?.textContent;
      })
      .toContain('Sin información disponible');
  });
});
