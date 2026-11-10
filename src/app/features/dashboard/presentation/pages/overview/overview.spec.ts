import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../../../core/auth/session';
import { API_URL } from '../../../../../core/http/api-url';
import { Overview } from './overview';
const summary = {
  as_of: '2026-10-10',
  period_from: '2026-10-01',
  period_to: '2026-10-10',
  herd: { total: 5, active: 4, exited: 1, female: 3, male: 1 },
  health: null,
  breeding: null,
  finance: null,
  feeding: null,
  activity: [],
};
describe('Ranch overview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Overview],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Session,
          useValue: { user: () => ({ permissions: ['animals:read'] }) },
        },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('shows real counts and hides areas without access', async () => {
    const f = TestBed.createComponent(Overview);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/dashboard/summary`)
      .flush(summary);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-testid=herd-summary]')?.textContent;
      })
      .toContain('4');
    expect(f.nativeElement.querySelector('[data-testid=finance-summary]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('3 hembras');
    expect(f.nativeElement.querySelector('app-herd-distribution')).not.toBeNull();
  });
  it('shows an error and retries', async () => {
    const f = TestBed.createComponent(Overview);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const url = `${TestBed.inject(API_URL)}/dashboard/summary`;
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('[role=alert]');
      })
      .toBe(true);
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('Reintentar'))!
      .click();
    http.expectOne(url).flush({ ...summary, herd: null });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Tu rol todavía');
    expect(f.nativeElement.querySelector('app-herd-distribution')).toBeNull();
  });
  it('shows case distribution for health readers while preserving the open-case card', async () => {
    TestBed.overrideProvider(Session, {
      useValue: { user: () => ({ permissions: ['health:read'] }) },
    });
    const f = TestBed.createComponent(Overview);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${TestBed.inject(API_URL)}/dashboard/summary`)
      .flush({
        ...summary,
        herd: null,
        health: {
          open_cases: 2,
          treatment_cases: 1,
          closed_cases: 3,
          total_cases: 6,
          attention_count: 0,
          pending: [],
        },
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('app-health-distribution canvas');
      })
      .toBe(true);
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === `${TestBed.inject(API_URL)}/dashboard/health-trend`)
      .flush({
        as_of: '2026-10-17',
        date_from: '2026-05-01',
        date_to: '2026-10-17',
        items: [],
        started_total: 0,
        closed_total: 0,
        event_count: 0,
      });
    expect(f.nativeElement.querySelector('[data-testid=health-summary]').textContent).toContain(
      '3',
    );
    expect(f.nativeElement.querySelector('app-health-distribution').textContent).toContain(
      '6 casos registrados',
    );
    expect(f.nativeElement.querySelector('app-herd-distribution')).toBeNull();
    expect(f.nativeElement.querySelector('app-finance-trend')).toBeNull();
  });
  it('loads the monthly reproductive chart only for a visible breeding summary', async () => {
    TestBed.overrideProvider(Session, {
      useValue: { user: () => ({ permissions: ['breeding:read'] }) },
    });
    const f = TestBed.createComponent(Overview);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      api = TestBed.inject(API_URL);
    http
      .expectOne(`${api}/dashboard/summary`)
      .flush({ ...summary, herd: null, breeding: { pregnant: 1, births: 2 } });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('app-breeding-trend');
      })
      .toBe(true);
    http
      .expectOne((r) => r.url === `${api}/dashboard/breeding-trend`)
      .flush({
        as_of: '2026-10-17',
        date_from: '2026-05-01',
        date_to: '2026-10-17',
        items: [],
        matings_total: 0,
        births_total: 0,
        event_count: 0,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-breeding-trend').textContent;
      })
      .toContain('No hay montas ni partos');
    expect(f.nativeElement.querySelector('app-finance-trend')).toBeNull();
    expect(f.nativeElement.querySelector('app-health-distribution')).toBeNull();
  });
  it('shows feeding charts to feeding readers without requesting finance data', async () => {
    TestBed.overrideProvider(Session, {
      useValue: { user: () => ({ permissions: ['feeding:read'] }) },
    });
    const f = TestBed.createComponent(Overview);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController),
      api = TestBed.inject(API_URL);
    http.expectOne(`${api}/dashboard/summary`).flush({
      ...summary,
      herd: null,
      feeding: { consumptions: 0, cost: '0.00', unpriced_count: 0 },
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!f.nativeElement.querySelector('app-feeding-trend');
      })
      .toBe(true);
    http
      .expectOne((r) => r.url === `${api}/dashboard/feeding-trend`)
      .flush({
        as_of: '2026-10-17',
        date_from: '2026-05-01',
        date_to: '2026-10-17',
        items: [],
        total_cost: '0.00',
        consumption_count: 0,
        unpriced_count: 0,
        quantities: [],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-feeding-trend').textContent;
      })
      .toContain('No hay consumos registrados');
    expect(f.nativeElement.querySelector('app-finance-trend')).toBeNull();
    expect(f.nativeElement.querySelector('app-breeding-trend')).toBeNull();
  });
});
