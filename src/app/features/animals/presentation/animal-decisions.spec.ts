import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnimalDecisions } from './animal-decisions';
import { Animal } from '../domain/animal';
const animal = {
  id: 'a1',
  name: 'Luna',
  siniiga: 'MX1',
  birth_date: '2024-01-01',
  is_breeder: false,
} as Animal;
const row = {
  id: 'd1',
  date: '2024-01-03',
  kind: 'retain_breeding',
  reason: 'Crecimiento registrado.',
  recorded_by: 'Cristopher Ozuna',
};
describe('Animal decisions', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimalDecisions],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture(write = true) {
    const f = TestBed.createComponent(AnimalDecisions);
    f.componentRef.setInput('animal', animal);
    f.componentRef.setInput('canWrite', write);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/animals/a1/decisions'))
      .flush({ items: [row], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Crecimiento registrado.');
    return f;
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    f.detectChanges();
  }
  it('displays immutable history for readers without registration controls', async () => {
    const f = await fixture(false);
    expect(f.nativeElement.querySelector('[data-testid=new-decision]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Cristopher Ozuna');
    expect(f.nativeElement.textContent).toContain('Conservar para reproducción');
    expect(f.nativeElement.querySelector('[data-decision-entry] button')).toBeNull();
  });
  it('stores a trimmed reason and reloads history without changing breeder state', async () => {
    const f = await fixture();
    const busy = vi.fn();
    f.componentInstance.busyChange.subscribe(busy);
    f.nativeElement.querySelector('[data-testid=new-decision]').click();
    f.detectChanges();
    fill(f, 'decision-date', '2024-01-03');
    fill(f, 'decision-kind', 'retain_breeding');
    fill(f, 'decision-reason', ' Buen crecimiento. ');
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const r = http.expectOne((req) => req.url.endsWith('/animals/a1/decisions'));
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({
      date: '2024-01-03',
      kind: 'retain_breeding',
      reason: 'Buen crecimiento.',
    });
    r.flush({ ...row, reason: 'Buen crecimiento.' });
    await expect
      .poll(
        () =>
          http
            .match((req) => req.method === 'GET')
            .map((r) => {
              r.flush({
                items: [{ ...row, reason: 'Buen crecimiento.' }],
                total: 1,
                offset: 0,
                limit: 25,
              });
              return r;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Decisión guardada');
    expect(animal.is_breeder).toBe(false);
    expect(busy.mock.calls).toEqual([[true], [false]]);
  });
  it('validates dates and preserves the form when the server rejects a write', async () => {
    const f = await fixture();
    f.nativeElement.querySelector('[data-testid=new-decision]').click();
    f.detectChanges();
    fill(f, 'decision-date', '2023-12-31');
    fill(f, 'decision-reason', 'Motivo registrado.');
    const submit = () =>
      f.nativeElement
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    submit();
    f.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.textContent).toContain('entre el nacimiento');
    fill(f, 'decision-date', '2024-01-03');
    submit();
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'Activity date is after animal exit' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('salida');
    expect(f.nativeElement.querySelector('#decision-reason').value).toBe('Motivo registrado.');
  });
  it('ignores late responses when a newer filter has completed', async () => {
    const f = await fixture();
    fill(f, 'decision-filter', 'sale_planned');
    const older = http.expectOne((r) => r.url.endsWith('/decisions'));
    fill(f, 'decision-filter', 'separate');
    const latest = http.expectOne((r) => r.url.endsWith('/decisions'));
    expect(latest.request.params.get('kind')).toBe('separate');
    latest.flush({ items: [], total: 0, offset: 0, limit: 25 });
    older.flush({ items: [row], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Sin decisiones registradas');
    expect(f.nativeElement.querySelector('[data-decision-entry]')).toBeNull();
  });
});
