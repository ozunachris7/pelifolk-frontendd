import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Performance } from './performance';
const animal = { id: 'f1', name: 'Luna', siniiga: 'MX1', sex: 'female' };
const metric = {
  animal,
  is_breeder: true,
  status: 'active',
  matings: 2,
  births: 2,
  offspring: 5,
  live_births: 3,
  stillbirths: 1,
  unknown_birth_condition: 1,
  post_birth_deaths: 1,
  in_herd: 2,
  other_exits: 1,
  weighed_offspring: 3,
  average_birth_weight_kg: '3.00',
  weaned_offspring: 2,
  average_weaning_weight_kg: '18.50',
  offspring_per_recorded_birth: '2.00',
};
const page = {
  as_of: '2026-10-14',
  sex: 'female',
  date_from: null,
  date_to: null,
  total: 1,
  summary: { offspring: 5, live_births: 3, stillbirths: 1, post_birth_deaths: 1 },
  offset: 0,
  limit: 25,
  items: [metric],
};
describe('Reproductive performance', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read'];
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
  async function fixture() {
    const f = TestBed.createComponent(Performance);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/breeding/performance'))
      .flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    return f;
  }
  it('keeps the period when switching to males and shows the male birth meaning', async () => {
    const f = await fixture();
    expect(f.nativeElement.querySelector('[data-weaning-metric]').textContent).toContain(
      '2 con destete registrado',
    );
    for (const [id, value] of [
      ['performance-from', '2024-01-01'],
      ['performance-to', '2024-12-31'],
    ]) {
      const input = f.nativeElement.querySelector('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('[data-performance-sex=male]').click();
    const req = TestBed.inject(HttpTestingController).expectOne((r) =>
      r.url.endsWith('/breeding/performance'),
    );
    expect(req.request.params.get('sex')).toBe('male');
    expect(req.request.params.get('date_from')).toBe('2024-01-01');
    req.flush({
      ...page,
      sex: 'male',
      date_from: '2024-01-01',
      date_to: '2024-12-31',
      items: [
        {
          ...metric,
          animal: { ...animal, id: 'm1', name: 'Trueno', sex: 'male' },
          offspring_per_recorded_birth: null,
        },
      ],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Partos con descendencia');
  });
  it('uses applied dates for descendants and separates birth condition from current status', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController);
    const from = f.nativeElement.querySelector('#performance-from');
    from.value = '2024-01-01';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    http
      .expectOne((r) => r.url.endsWith('/breeding/performance'))
      .flush({ ...page, date_from: '2024-01-01' });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[data-performance-row]');
      })
      .toBe(true);
    from.value = '2025-01-01';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('button[aria-label="Ver crías de Luna · MX1"]').click();
    const req = http.expectOne((r) => r.url.endsWith('/breeding/performance/f1/offspring'));
    expect(req.request.params.get('date_from')).toBe('2024-01-01');
    req.flush({
      as_of: '2026-10-14',
      date_from: '2024-01-01',
      date_to: null,
      parent: metric,
      total: 1,
      offset: 0,
      limit: 25,
      items: [
        {
          animal: { ...animal, id: 'c1', name: 'Estrella' },
          birth_date: '2024-06-01',
          born_alive: true,
          birth_weight_kg: '3.00',
          birth_event_id: 'b1',
          status: 'sale',
          exit_date: '2025-01-01',
          weaning: { date: '2024-08-01', weight_kg: '18.50', age_days: 61 },
        },
      ],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, app-modal')?.textContent;
      })
      .toContain('Nació viva');
    expect(f.nativeElement.querySelector('app-detail-page, app-modal').textContent).toContain(
      'Estado actual:',
    );
    expect(f.nativeElement.querySelector('[data-child-weaning]').textContent).toContain('18.50 kg');
    expect(f.nativeElement.querySelector('[data-child-weaning]').textContent).toContain('61 días');
    expect(f.nativeElement.querySelector('app-detail-page, app-modal').textContent).not.toContain(
      'Ver genealogía',
    );
  });
  it('keeps missing weanings distinct from zero weight', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController);
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    http
      .expectOne((r) => r.url.endsWith('/breeding/performance'))
      .flush({
        ...page,
        items: [{ ...metric, weaned_offspring: 0, average_weaning_weight_kg: null }],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Sin destetes registrados');
    expect(f.nativeElement.querySelector('[data-weaning-metric]').textContent).not.toContain(
      '0.00 kg',
    );
    f.nativeElement.querySelector('button[aria-label="Ver crías de Luna · MX1"]').click();
    http
      .expectOne((r) => r.url.endsWith('/f1/offspring'))
      .flush({
        as_of: page.as_of,
        date_from: null,
        date_to: null,
        parent: metric,
        total: 2,
        offset: 0,
        limit: 25,
        items: [
          {
            animal: { ...animal, id: 'c1' },
            birth_date: null,
            born_alive: null,
            birth_weight_kg: null,
            birth_event_id: null,
            status: 'active',
            exit_date: null,
            weaning: { date: '2024-08-01', weight_kg: '18.50', age_days: null },
          },
          {
            animal: { ...animal, id: 'c2' },
            birth_date: null,
            born_alive: null,
            birth_weight_kg: null,
            birth_event_id: null,
            status: 'active',
            exit_date: null,
            weaning: null,
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, app-modal')?.textContent;
      })
      .toContain('Edad al registrar: Desconocida');
    expect(f.nativeElement.querySelector('app-detail-page, app-modal').textContent).toContain(
      'Sin destete registrado.',
    );
  });
  it('rejects reversed dates and does not read without permission', async () => {
    const f = await fixture();
    for (const [id, value] of [
      ['performance-from', '2025-01-01'],
      ['performance-to', '2024-01-01'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('La fecha Desde debe ser anterior');
    TestBed.inject(HttpTestingController).expectNone((r) =>
      r.url.endsWith('/breeding/performance'),
    );
    f.destroy();
    permissions = [];
    const denied = TestBed.createComponent(Performance);
    denied.detectChanges();
    expect(denied.nativeElement.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
