import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../../core/auth/session';
import { GroupCostDistribution } from './group-cost-distribution';
const summary = {
  source_count: 1,
  attributed_expenses: '100.01',
  attributed_feeding: '20.00',
  source_expenses: '100.01',
  unallocated_expenses: '0.00',
  unallocated_feeding: '0.00',
  unpriced_feeding: 0,
  records_without_members: 0,
};
const source = {
  id: 's1',
  kind: 'expense',
  date: '2024-06-01',
  group_id: 'g1',
  group_name: 'Reproductoras',
  title: 'Servicio del lote',
  amount: '100.01',
  original_amount: '200.02',
  percentage: '50',
  member_count: 2,
  status: 'distributed',
};
const data = {
  kind: 'group',
  view: 'animals',
  feeding_included: true,
  as_of: '2026-10-16',
  summary,
  items: [
    {
      animal: { id: 'a1', name: 'Luna', siniiga: 'MX1' },
      expenses: '50.01',
      expense_records: 1,
      feeding: '10.00',
      feeding_records: 1,
      unpriced_feeding: 0,
    },
  ],
  total: 2,
  offset: 0,
  limit: 25,
};
describe('Calculated group cost distribution', () => {
  let http: HttpTestingController;
  let permissions = ['finance:read'];
  beforeEach(async () => {
    permissions = ['finance:read'];
    await TestBed.configureTestingModule({
      imports: [GroupCostDistribution],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture() {
    const f = TestBed.createComponent(GroupCostDistribution);
    f.componentRef.setInput('kind', 'group');
    f.componentRef.setInput('targetId', 'g1');
    f.componentRef.setInput('dateFrom', '2024-06-01');
    f.detectChanges();
    return f;
  }
  async function opened() {
    const f = fixture();
    http.expectNone((r) => r.url.endsWith('/group-costs'));
    f.nativeElement.querySelector('[data-group-distribution]').click();
    f.detectChanges();
    const r = http.expectOne((r) => r.url.endsWith('/group-costs'));
    expect(r.request.params.get('date_from')).toBe('2024-06-01');
    r.flush(data);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    return f;
  }
  it('loads lazily and keeps expense shares separate from feeding shares', async () => {
    const f = await opened();
    expect(f.nativeElement.querySelector('[data-attributed-expenses]').textContent).toContain(
      '100.01',
    );
    expect(f.nativeElement.querySelector('[data-attributed-feeding]').textContent).toContain(
      '20.00',
    );
    expect(f.nativeElement.textContent).not.toContain('120.01');
  });
  it('refreshes after the parent reloads edited assignments', async () => {
    const f = await opened();
    f.componentRef.setInput('revision', 1);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/group-costs'))
      .flush({ ...data, summary: { ...summary, attributed_expenses: '80.00' } });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('[data-attributed-expenses]')?.textContent;
      })
      .toContain('80.00');
  });
  it('opens source evidence lazily and shows recipients in a single modal', async () => {
    const f = await opened();
    const tab = Array.from(f.nativeElement.querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Origen del reparto',
    ) as HTMLButtonElement;
    tab.click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/group-costs') && r.params.get('view') === 'sources')
      .flush({ ...data, view: 'sources', items: [source], total: 1 });
    await expect
      .poll(() => {
        f.detectChanges();
        return (
          f.nativeElement.querySelector('button[aria-label="Ver reparto de Servicio del lote"]') !==
          null
        );
      })
      .toBe(true);
    http.expectNone((r) => r.url.includes('/sources/expense/'));
    f.nativeElement.querySelector('button[aria-label="Ver reparto de Servicio del lote"]').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/sources/expense/s1'))
      .flush({
        source,
        items: [
          { animal: { id: 'a1', name: 'Luna' }, amount: '50.01' },
          { animal: { id: 'a2', name: 'Trueno' }, amount: '50.00' },
        ],
        total: 2,
        offset: 0,
        limit: 25,
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Trueno');
    expect(f.nativeElement.querySelectorAll('dialog').length).toBe(1);
  });
  it('ignores an old response after changing the selected destination', async () => {
    const f = fixture();
    f.nativeElement.querySelector('[data-group-distribution]').click();
    f.detectChanges();
    const old = http.expectOne((r) => r.url.endsWith('/group-costs'));
    f.componentRef.setInput('targetId', 'g2');
    f.detectChanges();
    const next = http.expectOne((r) => r.url.endsWith('/group-costs'));
    next.flush({
      ...data,
      items: [{ ...data.items[0], animal: { id: 'a2', name: 'Trueno', siniiga: 'MX2' } }],
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Trueno');
    old.flush(data);
    await Promise.resolve();
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Luna');
  });
  it('does not render or query without finance read', () => {
    permissions = [];
    const f = fixture();
    expect(f.nativeElement.querySelector('[data-group-distribution]')).toBeNull();
    http.expectNone((r) => r.url.endsWith('/group-costs'));
  });
});
