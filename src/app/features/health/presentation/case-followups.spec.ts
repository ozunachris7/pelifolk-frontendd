import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CaseFollowups } from './case-followups';
import { ReviewList } from './review-list';
import { Session } from '../../../core/auth/session';
import { provideRouter } from '@angular/router';
describe('Clinical followups', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseFollowups, ReviewList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: Session,
          useValue: { user: () => ({ permissions: ['health:read', 'health:followups:create'] }) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture(write = true, closed = false) {
    const f = TestBed.createComponent(CaseFollowups);
    f.componentRef.setInput('caseId', 'c1');
    f.componentRef.setInput('startDate', '2024-01-01');
    f.componentRef.setInput('canWrite', write);
    f.componentRef.setInput('closed', closed);
    f.detectChanges();
    return f;
  }
  function fill(f: any, id: string, v: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = v;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    f.detectChanges();
  }
  it('saves an append-only followup with trimmed notes and a future review', async () => {
    const f = fixture();
    const saved = vi.fn();
    const busy = vi.fn();
    f.componentInstance.saved.subscribe(saved);
    f.componentInstance.busyChange.subscribe(busy);
    f.nativeElement.querySelector('[data-testid=new-followup]').click();
    f.detectChanges();
    fill(f, 'followup-date', '2024-01-03');
    fill(f, 'followup-notes', '  Menor dificultad al caminar.  ');
    fill(f, 'followup-review', '2099-01-01');
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const r = http.expectOne((req) => req.url.endsWith('/cases/c1/followups'));
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({
      date: '2024-01-03',
      evolution: 'improved',
      treatment_result: 'not_assessed',
      notes: 'Menor dificultad al caminar.',
      next_review_date: '2099-01-01',
    });
    r.flush({ id: 'f1' });
    await expect.poll(() => saved.mock.calls.length).toBe(1);
    expect(busy.mock.calls).toEqual([[true], [false]]);
  });
  it('keeps notes when the server rejects a closed case and validates review ordering', async () => {
    const f = fixture();
    f.nativeElement.querySelector('[data-testid=new-followup]').click();
    f.detectChanges();
    fill(f, 'followup-date', '2024-01-03');
    fill(f, 'followup-notes', 'Evaluación registrada.');
    fill(f, 'followup-review', '2024-01-02');
    const submit = () =>
      f.nativeElement
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    submit();
    f.detectChanges();
    http.expectNone((req) => req.method === 'POST');
    expect(f.nativeElement.textContent).toContain('no puede ser anterior');
    fill(f, 'followup-review', '');
    submit();
    const r = http.expectOne((req) => req.url.endsWith('/followups'));
    expect(r.request.body.next_review_date).toBeNull();
    r.flush({ detail: 'Health case is closed' }, { status: 409, statusText: 'Conflict' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('cerrado');
    expect(f.nativeElement.querySelector('#followup-notes').value).toBe('Evaluación registrada.');
  });
  it('shows history without registration for readers and closed cases', () => {
    for (const [write, closed] of [
      [false, false],
      [true, true],
    ]) {
      const f = fixture(write, closed);
      f.componentRef.setInput('entries', [
        {
          id: 'f1',
          date: '2024-01-03',
          evolution: 'recovered',
          treatment_result: 'effective',
          notes: 'Recuperación registrada.',
          next_review_date: null,
          recorded_by: 'Cris',
        },
      ]);
      f.detectChanges();
      expect(f.nativeElement.querySelector('[data-testid=new-followup]')).toBeNull();
      expect(f.nativeElement.textContent).toContain('Recuperado');
      f.destroy();
    }
  });
  it('lists pending reviews and links directly to their cases', async () => {
    const f = TestBed.createComponent(ReviewList);
    f.detectChanges();
    const r = http.expectOne((req) => req.url.endsWith('/health/reviews'));
    expect(r.request.params.get('state')).toBe('attention');
    r.flush({
      items: [
        {
          case: { id: 'c1', reason: 'Cojera', animal: { id: 'a1', name: 'Luna', siniiga: 'MX1' } },
          followup: { date: '2024-01-03', evolution: 'improved', recorded_by: 'Cris' },
          next_review_date: '2024-01-06',
          status: 'overdue',
        },
      ],
      total: 1,
      offset: 0,
      limit: 25,
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Vencida');
    expect(f.nativeElement.querySelector('tbody a').getAttribute('href')).toContain('case_id=c1');
  });
});
