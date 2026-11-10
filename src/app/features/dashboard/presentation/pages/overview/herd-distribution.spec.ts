import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { InteractiveChart } from '../../../../../shared/ui/chart/chart';
import { HerdCounts, HerdDistribution } from './herd-distribution';
const counts: HerdCounts = { total: 6, active: 4, exited: 2, female: 3, male: 1 };
function fixture(data = counts) {
  const f = TestBed.createComponent(HerdDistribution);
  f.componentRef.setInput('herd', data);
  f.componentRef.setInput('asOf', '2026-10-17');
  f.detectChanges();
  return f;
}
function chart(f: ComponentFixture<HerdDistribution>, index = 0): InteractiveChart {
  return f.debugElement.queryAll(By.directive(InteractiveChart))[index].componentInstance;
}
describe('Herd distribution', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HerdDistribution],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('keeps active-sex and whole-herd state denominators separate', () => {
    const f = fixture();
    expect(chart(f).model().series[0].values).toEqual([3, 1]);
    expect(chart(f, 1).model().series[0].values).toEqual([4, 2]);
    expect(chart(f).model().unit).toBe('animals');
    expect(f.nativeElement.querySelector('[data-testid=herd-sex-selection]').textContent).toContain(
      '75.0 % de los activos',
    );
    expect(
      f.nativeElement.querySelector('[data-testid=herd-state-selection]').textContent,
    ).toContain('66.7 % del total registrado');
    expect(f.nativeElement.textContent).toContain('17/10/2026');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(4);
  });
  it('updates the selected counts with keyboard navigation', () => {
    const f = fixture();
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid=herd-sex-selection]').textContent).toContain(
      'Machos · 1 animal · 25.0 %',
    );
  });
  it('shows no fabricated chart for an empty herd', () => {
    const f = fixture({ total: 0, active: 0, exited: 0, female: 0, male: 0 });
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Todavía no hay animales registrados');
  });
  it('can show all animals as exited without dividing sex percentages by zero', () => {
    const f = fixture({ total: 2, active: 0, exited: 2, female: 0, male: 0 });
    expect(f.nativeElement.querySelector('[data-testid=herd-sex-chart]')).toBeNull();
    expect(chart(f).model().series[0].values).toEqual([0, 2]);
    expect(f.nativeElement.textContent).toContain('No hay animales activos');
    expect(f.nativeElement.textContent).not.toMatch(/NaN|Infinity/);
  });
  it('updates both charts and selected percentages with refreshed summary counts', () => {
    const f = fixture();
    f.componentRef.setInput('herd', { total: 7, active: 5, exited: 2, female: 3, male: 2 });
    f.detectChanges();
    expect(chart(f).model().series[0].values).toEqual([3, 2]);
    expect(chart(f, 1).model().series[0].values).toEqual([5, 2]);
    expect(f.nativeElement.querySelector('[data-testid=herd-sex-selection]').textContent).toContain(
      '60.0 %',
    );
  });
});
