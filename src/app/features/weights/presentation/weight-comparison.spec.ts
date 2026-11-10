import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { vi } from 'vitest';
import { Session } from '../../../core/auth/session';
import { WeightRepository } from '../infrastructure/weight-repository';
import { InteractiveChart } from '../../../shared/ui/chart/chart';
import { WeightComparison } from './weight-comparison';
import { ComparisonAnimalSelect } from './comparison-animal-select';
const a = { id: 'a', name: 'Luna', siniiga: 'A' },
  b = { id: 'b', name: 'Estrella', siniiga: 'B' };
const record = (animal: typeof a, date: string, value: string, is_weaning = false) => ({
  id: date,
  animal,
  date,
  weight_kg: value,
  is_weaning,
  notes: null,
  recorded_by: 'Owner',
});
let history: ReturnType<typeof vi.fn>,
  permissions = signal(['weights:read']);
function fixture() {
  const f = TestBed.createComponent(WeightComparison);
  f.detectChanges();
  return f;
}
function add(f: any, animal = a) {
  f.debugElement
    .query(By.directive(ComparisonAnimalSelect))
    .componentInstance.selectedChange.emit(animal);
  f.detectChanges();
}
function date(f: any, id: string, value: string) {
  const el = f.nativeElement.querySelector('#comparison-' + id);
  el.value = value;
  el.dispatchEvent(new Event('input'));
  f.detectChanges();
}
function submit(f: any) {
  f.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  f.detectChanges();
}
async function loaded(f: any) {
  await expect
    .poll(() => {
      f.detectChanges();
      return !!f.nativeElement.querySelector('details');
    })
    .toBe(true);
}
describe('Weight comparison', () => {
  beforeEach(() => {
    permissions = signal(['weights:read']);
    history = vi.fn().mockImplementation((id: string) =>
      Promise.resolve(
        id === 'a'
          ? {
              animal: a,
              items: [record(a, '2024-01-01', '20.00'), record(a, '2024-02-01', '24.00', true)],
            }
          : { animal: b, items: [record(b, '2024-01-11', '21.00')] },
      ),
    );
    TestBed.configureTestingModule({
      imports: [WeightComparison],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: Session, useValue: { user: () => ({ permissions: permissions() }) } },
        { provide: WeightRepository, useValue: { history } },
      ],
    });
  });
  it('aligns real dates with missing values, includes weaning, and selects sparse measurements', async () => {
    const f = fixture();
    add(f);
    add(f, b);
    date(f, 'from', '2024-01-01');
    date(f, 'to', '2024-02-01');
    submit(f);
    await loaded(f);
    const chart = f.debugElement.query(By.directive(InteractiveChart))
      .componentInstance as InteractiveChart;
    expect(chart.model().series.map((s) => s.values)).toEqual([
      [20, null, 24],
      [null, 21, null],
    ]);
    expect(chart.model().days![1] - chart.model().days![0]).toBe(10);
    expect(chart.model().days![2] - chart.model().days![1]).toBe(21);
    expect(new Set(chart.model().series.map((s) => s.tone)).size).toBe(2);
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges();
    expect(
      f.nativeElement.querySelector('[data-testid=comparison-selection]').textContent,
    ).toContain('Sin pesaje ese día');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
    expect(f.nativeElement.textContent).toContain('Destete');
  });
  it('filters exact boundaries without replacing absent weights by zero and handles empty periods', async () => {
    const f = fixture();
    add(f);
    add(f, b);
    date(f, 'from', '2024-01-11');
    date(f, 'to', '2024-01-11');
    submit(f);
    await loaded(f);
    expect(f.nativeElement.textContent).toContain('Sin pesajes en este periodo');
    expect(f.nativeElement.textContent).toContain('Solo hay una fecha registrada');
    const chart = f.debugElement.query(By.directive(InteractiveChart))
      .componentInstance as InteractiveChart;
    expect(chart.model().series.map((s) => s.values)).toEqual([[null], [21]]);
    date(f, 'from', '2025-01-01');
    date(f, 'to', '2025-01-31');
    submit(f);
    await loaded(f);
    expect(f.nativeElement.querySelector('canvas')).toBeNull();
    expect(f.nativeElement.textContent).toContain('No hay pesajes');
  });
  it('prevents duplicates and limits the selection to five while retaining removal', () => {
    const f = fixture();
    add(f);
    add(f);
    expect(f.nativeElement.textContent).toContain('ya está seleccionado');
    for (let i = 1; i < 5; i++) add(f, { id: 'x' + i, name: 'Demo ' + i, siniiga: null } as any);
    expect(f.nativeElement.querySelector('app-comparison-animal-select')).toBeNull();
    f.nativeElement.querySelector('button[aria-label^="Quitar"]').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-comparison-animal-select')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('4 de 5');
  });
  it('requires two animals and validates ordered dates before fetching', () => {
    const f = fixture();
    add(f);
    submit(f);
    expect(history).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('entre dos y cinco');
    add(f, b);
    date(f, 'from', '2025-02-01');
    date(f, 'to', '2025-01-01');
    submit(f);
    expect(history).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('fechas en orden');
  });
  it('offers retry after failure and discards late responses after selection changes', async () => {
    const f = fixture();
    add(f);
    add(f, b);
    history.mockRejectedValueOnce(new Error('unavailable'));
    submit(f);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('unavailable');
    const resolves: any[] = [];
    history.mockImplementation(() => new Promise((r) => resolves.push(r)));
    submit(f);
    f.nativeElement.querySelector('button[aria-label^="Quitar"]').click();
    f.detectChanges();
    resolves.forEach((resolve) => resolve({ animal: b, items: [] }));
    await new Promise(resolve => setTimeout(resolve,0));
    f.detectChanges();
    expect(f.nativeElement.querySelector('details')).toBeNull();
  });
  it('does not expose comparisons or fetch options without permission', () => {
    permissions.set([]);
    const f = fixture();
    expect(f.nativeElement.querySelector('app-comparison-animal-select')).toBeNull();
    expect(f.nativeElement.querySelector('form')).toBeNull();
    expect(history).not.toHaveBeenCalled();
  });
});
