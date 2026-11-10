import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Indicators } from './indicators';
const animal = { id: 'm1', name: 'Luna', siniiga: 'MX1' };
const duration = { count: 0, total_days: 0, average_days: null, min_days: null, max_days: null };
const metric = {
  births: 1,
  birth_intervals: duration,
  pregnancy: {
    matings: 2,
    pregnant: 0,
    not_pregnant: 0,
    uncertain: 1,
    no_diagnosis: 1,
    diagnosed: 0,
    percentage: null,
    unlinked_diagnoses: 1,
    first_positive_delay: duration,
  },
  followup: {
    total: 4,
    live_births: 2,
    stillbirths: 1,
    unknown_birth_condition: 1,
    missing_birth_date: 0,
    too_young: 1,
    unobservable: 1,
    without_recorded_death: 0,
    deaths: 0,
    observable: 0,
    percentage: null,
  },
};
const row = { animal, ...metric };
const context = {
  as_of: '2024-06-30',
  date_from: '2024-01-01',
  date_to: '2024-01-31',
  age_days: 60,
};
const page = { ...context, items: [row], summary: metric, total: 1, offset: 0, limit: 25 };
const detail = (section: string, items: unknown[] = []) => ({
  ...context,
  parent: row,
  section,
  items,
  total: items.length,
  offset: 0,
  limit: 25,
});
describe('Recorded reproductive indicators', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read'];
    await TestBed.configureTestingModule({
      imports: [Indicators],
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
    const f = TestBed.createComponent(Indicators);
    const h = TestBed.inject(HttpTestingController);
    h.expectOne((r) => r.url.endsWith('/breeding/indicators')).flush(page);
    f.detectChanges();
    return { f, h };
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event('input'));
    f.detectChanges();
  }
  it('requests no reproductive data without permission', () => {
    permissions = ['animals:read'];
    const f = TestBed.createComponent(Indicators);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/indicators'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
  });
  it('shows unknown denominators as no base rather than zero percent', async () => {
    const { f } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Sin base');
    expect(f.nativeElement.textContent).toContain('0 / 0 con diagnóstico concluyente');
    expect(f.nativeElement.textContent).not.toContain('0 %');
    expect(f.nativeElement.textContent).toContain('No es una tasa de fertilidad biológica');
  });
  it('freezes the submitted cohort and cutoff for detail requests', async () => {
    const { f, h } = open();
    fill(f, 'indicator-from', '2024-01-01');
    fill(f, 'indicator-to', '2024-01-31');
    fill(f, 'indicator-cutoff', '2024-06-30');
    fill(f, 'indicator-age', '90');
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    const request = h.expectOne((r) => r.url.endsWith('/breeding/indicators'));
    expect(request.request.params.get('age_days')).toBe('90');
    expect(request.request.params.get('as_of')).toBe('2024-06-30');
    request.flush({ ...page, age_days: 90 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-indicator-row] button');
      })
      .not.toBeNull();
    fill(f, 'indicator-cutoff', '2024-12-31');
    f.nativeElement.querySelector('[data-indicator-row] button').click();
    f.detectChanges();
    const d = h.expectOne((r) => r.url.endsWith('/m1/details'));
    expect(d.request.params.get('as_of')).toBe('2024-06-30');
    expect(d.request.params.get('age_days')).toBe('90');
    expect(d.request.params.get('date_to')).toBe('2024-01-31');
    d.flush(
      detail('birth_intervals', [
        {
          previous_date: '2023-06-01',
          date: '2024-01-01',
          days: 214,
          predecessor_outside_period: true,
        },
      ]),
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('El parto anterior queda fuera del periodo');
  });
  it('distinguishes early exits and incomplete birth data in offspring details', async () => {
    const { f, h } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-indicator-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-indicator-row] button').click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/m1/details')).flush(detail('birth_intervals'));
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog');
      })
      .not.toBeNull();
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('app-detail-page button, dialog button'),
    ) as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Crías por edad'))!.click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/m1/details')).flush(
      detail('offspring', [
        {
          animal: { id: 'c1', name: 'Estrella', siniiga: null },
          birth_date: '2024-01-01',
          target_date: '2024-03-01',
          state: 'unobservable',
          exit_date: '2024-02-01',
        },
      ]),
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('seguimiento incompleto');
    expect(f.nativeElement.querySelector('app-detail-page, dialog').textContent).toContain(
      'Fuera del cálculo',
    );
  });
  it('ignores late detail responses after changing sections', async () => {
    const { f, h } = open();
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-indicator-row] button');
      })
      .not.toBeNull();
    f.nativeElement.querySelector('[data-indicator-row] button').click();
    f.detectChanges();
    const old = h.expectOne((r) => r.url.endsWith('/m1/details'));
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('app-detail-page button, dialog button'),
    ) as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Montas y diagnósticos'))!.click();
    f.detectChanges();
    h.expectOne((r) => r.url.endsWith('/m1/details')).flush(
      detail('matings', [
        {
          date: '2024-01-01',
          result: 'no_diagnosis',
          diagnosis_date: null,
          first_positive_days: null,
        },
      ]),
    );
    old.flush(detail('birth_intervals', [{ days: 9999 }]));
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, dialog')?.textContent;
      })
      .toContain('Sin diagnóstico vinculado');
    expect(f.nativeElement.querySelector('app-detail-page, dialog').textContent).not.toContain(
      '9999',
    );
  });
  it('rejects invalid cutoff and age without requesting new results', () => {
    const { f, h } = open();
    fill(f, 'indicator-cutoff', '2024-01-01');
    fill(f, 'indicator-to', '2024-02-01');
    fill(f, 'indicator-age', '0');
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
    h.expectNone((r) => r.url.includes('/indicators'));
    expect(f.nativeElement.textContent).toContain('Revisa las fechas');
  });
});
