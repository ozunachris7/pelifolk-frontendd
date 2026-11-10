import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { InteractiveChart } from '../../../../../shared/ui/chart/chart';
import { HealthCounts, HealthDistribution } from './health-distribution';
const counts: HealthCounts = { open_cases: 3, treatment_cases: 2, closed_cases: 1, total_cases: 6 };
function fixture(data = counts) {
  const f = TestBed.createComponent(HealthDistribution);
  f.componentRef.setInput('health', data);
  f.componentRef.setInput('asOf', '2026-10-17');
  f.detectChanges();
  return f;
}
function chart(f: ComponentFixture<HealthDistribution>): InteractiveChart {
  return f.debugElement.query(By.directive(InteractiveChart)).componentInstance;
}
describe('Sanitary case distribution', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthDistribution],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('uses the three case states with exact counts and percentages', () => {
    const f = fixture();
    expect(chart(f).model().labels).toEqual(['Abiertos', 'En tratamiento', 'Cerrados']);
    expect(chart(f).model().series[0].values).toEqual([3, 2, 1]);
    expect(chart(f).model().unit).toBe('cases');
    expect(f.nativeElement.querySelector('[data-testid=health-selection]').textContent).toContain(
      '3 casos · 50.0 %',
    );
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
    expect(f.nativeElement.textContent).toContain('Un animal puede tener varios casos');
  });
  it('selects a case state with keyboard navigation', () => {
    const f = fixture();
    f.nativeElement
      .querySelector('canvas')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid=health-selection]').textContent).toContain(
      'Cerrados · 1 caso · 16.7 %',
    );
  });
  it('shows an empty state without inventing bars or dividing by zero', () => {
    const f = fixture({ open_cases: 0, treatment_cases: 0, closed_cases: 0, total_cases: 0 });
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Todavía no hay casos sanitarios registrados');
    expect(f.nativeElement.textContent).not.toMatch(/NaN|Infinity/);
  });
  it('can show a history consisting entirely of closed cases', () => {
    const f = fixture({ open_cases: 0, treatment_cases: 0, closed_cases: 3, total_cases: 3 });
    expect(chart(f).selectedIndex()).toBe(2);
    expect(chart(f).model().series[0].values).toEqual([0, 0, 3]);
    expect(f.nativeElement.querySelector('[data-testid=health-selection]').textContent).toContain(
      'Cerrados · 3 casos · 100.0 %',
    );
  });
  it('refreshes counts, percentages and date when the summary changes', () => {
    const f = fixture();
    f.componentRef.setInput('health', {
      open_cases: 2,
      treatment_cases: 1,
      closed_cases: 1,
      total_cases: 4,
    });
    f.componentRef.setInput('asOf', '2026-10-18');
    f.detectChanges();
    expect(chart(f).model().series[0].values).toEqual([2, 1, 1]);
    expect(f.nativeElement.querySelector('[data-testid=health-selection]').textContent).toContain(
      '2 casos · 50.0 %',
    );
    expect(f.nativeElement.textContent).toContain('18/10/2026');
  });
});
