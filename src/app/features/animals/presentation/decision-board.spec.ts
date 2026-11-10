import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { DecisionBoard } from './decision-board';
const entry = {
  animal: { id: 'a1', name: 'Luna', siniiga: 'MX1', sex: 'female', is_breeder: true },
  status: 'active',
  decision: {
    id: 'd1',
    date: '2026-10-01',
    kind: 'sale_planned',
    reason: 'Cambio de manejo documentado',
    recorded_by: 'Cristopher',
  },
};
describe('Current management decisions', () => {
  let http: HttpTestingController;
  let permissions = ['animals:read'];
  beforeEach(async () => {
    permissions = ['animals:read'];
    await TestBed.configureTestingModule({
      imports: [DecisionBoard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture() {
    const f = TestBed.createComponent(DecisionBoard);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/management-decisions'))
      .flush({
        items: [entry],
        total: 1,
        offset: 0,
        limit: 25,
        as_of: '2026-10-16',
        summary: { sale_planned: 1 },
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    return f;
  }
  it('shows scoped context as unavailable and links to the exact animal', async () => {
    const f = await fixture();
    expect(f.nativeElement.textContent).toContain('Sin acceso a contexto');
    expect(f.nativeElement.querySelector('tbody a').getAttribute('href')).toContain('animal_id=a1');
    expect(f.nativeElement.querySelector('tbody').textContent).not.toContain('0 casos');
  });
  it('loads history lazily and preserves current decision when contextual notes exist', async () => {
    const f = await fixture();
    f.nativeElement.querySelector('tbody button').click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url.endsWith('/animals/a1/decisions'));
    r.flush({
      items: [{ ...entry.decision, id: 'd2', kind: 'other', reason: 'Antecedente contextual' }],
      total: 1,
      offset: 0,
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Antecedente contextual');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('Venta prevista');
    f.destroy();
  });
  it('sends selected filters and resets pagination on submit', async () => {
    const f = await fixture();
    const select = f.nativeElement.querySelector('select[aria-label="Decisión"]');
    select.value = 'retain_breeding';
    select.dispatchEvent(new Event('change'));
    f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    http
      .expectOne(
        (r) =>
          r.url.endsWith('/management-decisions') &&
          r.params.get('kind') === 'retain_breeding' &&
          r.params.get('offset') === '0',
      )
      .flush({ items: [], total: 0, offset: 0, limit: 25, summary: {} });
  });
  it('does not query without animals read', () => {
    permissions = [];
    const f = TestBed.createComponent(DecisionBoard);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    http.expectNone((r) => r.url.endsWith('/management-decisions'));
  });
});
