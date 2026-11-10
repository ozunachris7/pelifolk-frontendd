import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { UpcomingBirths } from './upcoming-births';
import { BreedingList } from './breeding-list';
import { BreedingRepository } from '../infrastructure/breeding-repository';
const animal = { id: 'f1', name: 'Luna', siniiga: 'MX1', sex: 'female' };
const page = {
  as_of: '2026-10-10',
  gestation_days: 147,
  notice_days: 14,
  total: 2,
  counts: { upcoming: 1, missing_mating: 1 },
  offset: 0,
  limit: 25,
  items: [
    {
      id: 'p1',
      animal,
      diagnosis_date: '2026-10-01',
      mating_event_id: 'm1',
      mating_date: '2026-05-20',
      male: null,
      expected_birth_date: '2026-10-14',
      days_remaining: 4,
      status: 'upcoming',
      missing_reason: null,
    },
    {
      id: 'p2',
      animal: { ...animal, id: 'f2', name: 'Canela' },
      diagnosis_date: '2026-10-01',
      mating_event_id: null,
      mating_date: null,
      male: null,
      expected_birth_date: null,
      days_remaining: null,
      status: 'missing_mating',
      missing_reason: 'unlinked',
    },
  ],
};
describe('Upcoming births', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read', 'breeding:write'];
    await TestBed.configureTestingModule({
      imports: [UpcomingBirths, BreedingList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'dashboard/breeding', component: BreedingList }]),
        BreedingRepository,
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const f = TestBed.createComponent(UpcomingBirths);
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/breeding/upcoming-births'))
      .flush(page);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Canela');
    return f;
  }
  it('shows estimates separately from missing mating dates and provides birth registration', async () => {
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('En 4 días');
    expect(f.nativeElement.textContent).toContain('Diagnóstico sin monta vinculada');
    expect(f.nativeElement.querySelector('a[href="/dashboard/breeding?kind=birth"]')).toBeTruthy();
  });
  it('applies status and notice filters and rejects invalid notice days', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController);
    const status = f.nativeElement.querySelector('#upcoming-status');
    status.value = 'upcoming';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    const notice = f.nativeElement.querySelector('#upcoming-notice');
    notice.value = '30';
    notice.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    const r = http.expectOne((r) => r.url.endsWith('/breeding/upcoming-births'));
    expect(r.request.params.get('status')).toBe('upcoming');
    expect(r.request.params.get('notice_days')).toBe('30');
    r.flush({
      ...page,
      notice_days: 30,
      items: [page.items[0]],
      total: 1,
      counts: { upcoming: 1 },
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('siguientes 30 días');
    notice.value = '0';
    notice.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('1 a 60 días');
    http.expectNone((r) => r.url.endsWith('/breeding/upcoming-births'));
  });
  it('opens history without animal read permission', async () => {
    permissions = ['breeding:read'];
    const f = await fixture();
    expect(f.nativeElement.textContent).not.toContain('Ir a registrar parto');
    f.nativeElement.querySelector('button[aria-label="Ver historial de Luna · MX1"]').click();
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http.expectOne(`${url}/breeding/animals/f1/history`).flush({ animal, items: [] });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-detail-page, app-modal')?.textContent;
      })
      .toContain('Luna');
  });
  it('opens the birth tab from the upcoming registration link', async () => {
    await RouterTestingHarness.create('/dashboard/breeding?kind=birth');
    const r = TestBed.inject(HttpTestingController).expectOne((r) =>
      r.url.endsWith('/breeding/events'),
    );
    expect(r.request.params.get('kind')).toBe('birth');
    r.flush({ items: [], total: 0, offset: 0, limit: 25 });
  });
});
