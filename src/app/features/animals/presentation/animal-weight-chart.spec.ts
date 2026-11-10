import { By } from '@angular/platform-browser';
import { InteractiveChart } from '../../../shared/ui/chart/chart';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { WeightHistory } from '../../weights/domain/weights';
import { AnimalWeightChart } from './animal-weight-chart';
const animal = { id: '30000000-0000-4000-8000-000000000001', name: 'Luna', siniiga: 'PRUEBA-001' };
const sample: WeightHistory = {
  animal,
  items: [
    {
      id: 'w1',
      animal,
      date: '2024-01-01',
      weight_kg: '20.00',
      notes: null,
      recorded_by: 'Cristopher',
    },
    {
      id: 'w2',
      animal,
      date: '2024-01-11',
      weight_kg: '22.00',
      notes: 'Destete registrado',
      recorded_by: 'Cristopher',
      is_weaning: true,
    },
    {
      id: 'w3',
      animal,
      date: '2024-02-10',
      weight_kg: '21.00',
      notes: null,
      recorded_by: 'Cristopher',
    },
  ],
};
let http: HttpTestingController, api: string;
let permissions = signal(['weights:read']);
function url(id = animal.id) {
  return `${api}/weights/animals/${id}/history`;
}
function fixture() {
  const f = TestBed.createComponent(AnimalWeightChart);
  f.componentRef.setInput('animalId', animal.id);
  f.detectChanges();
  return f;
}
function render(f: ComponentFixture<AnimalWeightChart>, data = sample) {
  http.expectOne(url()).flush(data);
  f.detectChanges();
}
function date(f: ComponentFixture<AnimalWeightChart>, id: string, value: string) {
  const el = f.nativeElement.querySelector(id) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  f.detectChanges();
}
function submit(f: ComponentFixture<AnimalWeightChart>) {
  f.nativeElement
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  f.detectChanges();
}
function graph(f: ComponentFixture<AnimalWeightChart>): InteractiveChart {
  return f.debugElement.query(By.directive(InteractiveChart)).componentInstance;
}
describe('Animal weight chart', () => {
  beforeEach(async () => {
    permissions = signal(['weights:read']);
    await TestBed.configureTestingModule({
      imports: [AnimalWeightChart],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions: permissions() }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => http.verify());
  it('plots dates proportionally and selects actual weights, including weaning, with the keyboard', () => {
    const f = fixture();
    render(f);
    const chart = graph(f);
    expect(chart.model().labels.length).toBe(3);
    const days = chart.model().days!;
    expect(days[2] - days[1]).toBe(3 * (days[1] - days[0]));
    expect(f.nativeElement.querySelector('[aria-live=polite]').textContent).toContain(
      'Pérdida de peso registrada',
    );
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(graph(f).selectedIndex()).toBe(1);
    expect(f.nativeElement.querySelector('[aria-live=polite]').textContent).toContain(
      'Pesaje de destete',
    );
    expect(f.nativeElement.querySelector('[aria-live=polite]').textContent).toContain('22.00 kg');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
  });
  it('filters locally while retaining the previous measurement outside the period', () => {
    const f = fixture();
    render(f);
    date(f, '#animal-weight-from', '2024-02-10');
    date(f, '#animal-weight-to', '2024-02-10');
    submit(f);
    expect(graph(f).model().labels.length).toBe(1);
    expect(graph(f).model().series[0].values.length).toBe(1);
    const selected = f.nativeElement.querySelector('[aria-live=polite]').textContent;
    expect(selected).toContain('-1.00 kg');
    expect(selected).toContain('30 días');
    expect(selected).toContain('-0.033 kg/día');
    expect(f.nativeElement.textContent).toContain('un solo pesaje');
    http.expectNone(url());
    [...f.nativeElement.querySelectorAll('button')]
      .find((button: any) => button.textContent.trim() === 'Ver todo')!
      .click();
    f.detectChanges();
    expect(graph(f).model().labels.length).toBe(3);
  });
  it('shows distinct states for no weights, one weight and dates without matches', () => {
    const f = fixture();
    render(f, { animal, items: [] });
    expect(f.nativeElement.textContent).toContain('todavía no tiene pesajes');
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    render(f, { animal, items: sample.items.slice(0, 1) });
    expect(f.nativeElement.textContent).toContain('un solo pesaje');
    expect(graph(f).model().series[0].values.length).toBe(1);
    expect(f.nativeElement.textContent).toContain('Primer pesaje registrado');
    date(f, '#animal-weight-from', '2025-01-01');
    submit(f);
    expect(f.nativeElement.textContent).toContain('No hay pesajes en estas fechas');
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
  });
  it('rejects reversed dates and keeps the applied chart until a valid filter is submitted', () => {
    const f = fixture();
    render(f);
    date(f, '#animal-weight-from', '2024-02-01');
    date(f, '#animal-weight-to', '2024-01-01');
    submit(f);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('fechas en orden');
    expect(graph(f).model().labels.length).toBe(3);
    http.expectNone(url());
  });
  it('does not render or fetch weight information without permission', () => {
    permissions.set(['animals:read']);
    const f = fixture();
    expect(f.nativeElement.querySelector('section')).toBeNull();
    http.expectNone(url());
  });
  it('cancels the previous animal request and clears its data when switching animals', () => {
    const f = fixture();
    const old = http.expectOne(url());
    f.componentRef.setInput('animalId', 'another-animal');
    f.detectChanges();
    expect(old.cancelled).toBe(true);
    http
      .expectOne(url('another-animal'))
      .flush({ animal: { ...animal, id: 'another-animal' }, items: [] });
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-chart')).toBeNull();
    expect(f.nativeElement.textContent).toContain('todavía no tiene pesajes');
  });
  it('offers retry after an error and cancels pending requests when destroyed', () => {
    const f = fixture();
    http.expectOne(url()).flush({}, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    f.nativeElement.querySelector('[role=alert] button').click();
    f.detectChanges();
    render(f);
    expect(graph(f).model().labels.length).toBe(3);
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    const pending = http.expectOne(url());
    f.destroy();
    expect(pending.cancelled).toBe(true);
  });
});
