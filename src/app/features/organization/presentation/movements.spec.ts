import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Movements } from './movements';
const animal = { id: 'a1', name: 'Luna', siniiga: 'MX1' };
const locations = [
  { id: 'l1', name: 'Corral norte', active: true },
  { id: 'l2', name: 'Potrero sur', active: true },
];
const position = {
  animal,
  exited: false,
  current_location: { ...locations[0], since: '2024-01-01' },
  last_known_location: { ...locations[0], since: '2024-01-01' },
};
const page = { as_of: '2026-10-14', items: [position], total: 1, offset: 0, limit: 25 };
describe('Animal location movements', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['locations:read', 'locations:write'];
    await TestBed.configureTestingModule({
      imports: [Movements],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture(data = page) {
    const f = TestBed.createComponent(Movements);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/locations')).flush(locations);
    http.expectOne((r) => r.url.endsWith('/animal-positions')).flush(data);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Luna');
    return f;
  }
  it('saves a destination and reason, then refreshes current location', async () => {
    const f = await fixture(),
      http = TestBed.inject(HttpTestingController);
    f.nativeElement.querySelector('button[aria-label="Cambiar ubicación de Luna · MX1"]').click();
    http.expectOne((r) => r.url.endsWith('/locations')).flush(locations);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#movement-target option[value=l2]');
      })
      .toBeTruthy();
    for (const [id, value] of [
      ['movement-target', 'l2'],
      ['movement-date', '2024-01-03'],
      ['movement-reason', 'Pastoreo'],
    ]) {
      const e = f.nativeElement.querySelector('#' + id);
      e.value = value;
      e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    f.nativeElement
      .querySelector('app-modal form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    const r = http.expectOne((r) => r.method === 'POST');
    expect(r.request.body).toEqual({
      animal_id: 'a1',
      location_id: 'l2',
      date: '2024-01-03',
      reason: 'Pastoreo',
    });
    r.flush({ id: 'e1' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Ubicación del animal registrada');
    http
      .expectOne((r) => r.url.endsWith('/animal-positions'))
      .flush({
        ...page,
        items: [
          {
            ...position,
            current_location: { ...locations[1], since: '2024-01-03' },
            last_known_location: { ...locations[1], since: '2024-01-03' },
          },
        ],
      });
  });
  it('shows historical locations for an exited animal and removes movement actions', async () => {
    permissions = ['locations:read'];
    const f = await fixture({
      ...page,
      items: [{ ...position, exited: true, current_location: null }],
    } as any);
    expect(f.nativeElement.textContent).toContain('Última conocida');
    expect(f.nativeElement.querySelector('button[aria-label^="Cambiar ubicación"]')).toBeNull();
    f.nativeElement
      .querySelector('button[aria-label="Historial de ubicación de Luna · MX1"]')
      .click();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/animals/a1/history'))
      .flush({
        ...position,
        exited: true,
        current_location: null,
        as_of: '2026-10-14',
        total: 1,
        offset: 0,
        limit: 25,
        items: [
          {
            id: 'e1',
            date: '2024-01-01',
            from_location: null,
            to_location: position.last_known_location,
            reason: 'Ingreso al corral',
            event_type_id: 9,
            recorded_by: 'Cristopher Ozuna',
          },
        ],
      });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('app-modal')?.textContent;
      })
      .toContain('Ingreso al corral');
  });
  it('does not request locations without read permission', () => {
    permissions = [];
    const f = TestBed.createComponent(Movements);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
