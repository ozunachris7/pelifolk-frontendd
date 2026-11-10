import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../core/auth/session';
import { WeaningList } from './weaning-list';
const mother = { id: 'm1', name: 'Luna', siniiga: 'MX1' };
const animal = { id: 'a1', name: 'Aurora', siniiga: 'MX2', birth_date: '2024-01-01', mother };
const saved = {
  id: 'e1',
  animal,
  mother,
  date: '2024-03-01',
  weight_kg: '18.50',
  age_days: 60,
  birth_date_snapshot: '2024-01-01',
  notes: 'Destete registrado.',
  recorded_by: 'Cris',
};
describe('Weaning records', () => {
  let permissions: string[];
  let http: HttpTestingController;
  beforeEach(async () => {
    permissions = ['weights:read', 'weights:write'];
    await TestBed.configureTestingModule({
      imports: [WeaningList],
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
    const f = TestBed.createComponent(WeaningList);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/weanings'))
      .flush({ items: [], total: 0, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('No hay destetes registrados');
    return f;
  }
  async function open(f: any) {
    f.nativeElement.querySelector('[data-testid=new-weaning]').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/weanings/animal-options')).flush([animal]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#weaning-animal').options.length;
      })
      .toBe(2);
  }
  function fill(f: any, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    f.detectChanges();
  }
  function submit(f: any) {
    f.nativeElement
      .querySelector('dialog form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
  }
  it('uses only weight permissions and hides write controls for readers', async () => {
    permissions = [];
    const denied = TestBed.createComponent(WeaningList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes('/weanings'));
    expect(denied.nativeElement.textContent).toContain('No tienes permiso');
    denied.destroy();
    permissions = ['weights:read'];
    const f = await fixture();
    expect(f.nativeElement.querySelector('[data-testid=new-weaning]')).toBeNull();
  });
  it('registers a weaning and shows its mother, age and weight', async () => {
    const f = await fixture();
    await open(f);
    fill(f, 'weaning-animal', 'a1');
    fill(f, 'weaning-date', '2024-03-01');
    fill(f, 'weaning-weight', '18.50');
    fill(f, 'weaning-notes', ' Destete registrado. ');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('Luna');
    submit(f);
    const r = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/weanings'));
    expect(r.request.body).toEqual({
      animal_id: 'a1',
      date: '2024-03-01',
      weight_kg: 18.5,
      notes: 'Destete registrado.',
    });
    r.flush(saved);
    await expect
      .poll(
        () =>
          http
            .match((req) => req.url.endsWith('/weanings') && req.method === 'GET')
            .map((r) => {
              r.flush({ items: [saved], total: 1, offset: 0, limit: 25 });
              return r;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('60 días');
    expect(f.nativeElement.querySelector('dialog').textContent).toContain('Destete registrado.');
  });
  it('preserves the capture while consulting an existing weight', async () => {
    const f = await fixture();
    await open(f);
    fill(f, 'weaning-animal', 'a1');
    fill(f, 'weaning-date', '2024-03-01');
    fill(f, 'weaning-weight', '18.5');
    fill(f, 'weaning-notes', 'Observación pendiente');
    [...f.nativeElement.querySelectorAll('dialog button')]
      .find((b: any) => b.textContent.includes('Consultar pesajes'))
      .click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/weights/animals/a1/history'))
      .flush({
        animal,
        items: [{ id: 'e1', date: '2024-03-01', weight_kg: '18.50', recorded_by: 'Cris' }],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('18.50');
    [...f.nativeElement.querySelectorAll('dialog button')]
      .find((b: any) => b.textContent.includes('Volver al registro'))
      .click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('#weaning-notes').value).toBe('Observación pendiente');
    expect(f.nativeElement.querySelector('#weaning-weight').value).toBe('18.5');
  });
  it('rejects same-day birth locally and preserves fields when the existing weight differs', async () => {
    const f = await fixture();
    await open(f);
    fill(f, 'weaning-animal', 'a1');
    fill(f, 'weaning-date', '2024-01-01');
    fill(f, 'weaning-weight', '18.5');
    submit(f);
    http.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.textContent).toContain('posterior al nacimiento');
    fill(f, 'weaning-date', '2024-03-01');
    submit(f);
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'Weaning weight differs from existing daily weight' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Consulta los pesajes');
    expect(f.nativeElement.querySelector('#weaning-animal').value).toBe('a1');
  });
});
