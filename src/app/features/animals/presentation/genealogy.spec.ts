import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { Genealogy } from './genealogy';
const animal = (id: string, name: string, sex = 'female') => ({
  id,
  name,
  siniiga: 'MX' + id,
  sex,
  birth_date: '2020-01-01',
  origin: 'born_in_herd',
  mother_id: null,
  father_id: null,
  is_breeder: false,
  created_at: '2020-01-01T00:00:00',
  breeds: [],
  mother: null,
  father: null,
  status: 'active',
  exit_date: null,
  purity: null,
});
const root = animal('a1', 'Luna'),
  mother = animal('m1', 'Madre'),
  grandma = animal('g1', 'Abuela'),
  child = animal('c1', 'Estrella');
const node = (a: any, mother: any = null, father: any = null) => ({ animal: a, mother, father });
const family = {
  as_of: '2026-10-10',
  tree: node(root, node(mother, node(grandma))),
  children: [child],
  total_children: 1,
  female_children: 1,
  male_children: 0,
  offset: 0,
  limit: 12,
};
describe('Genealogy', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['animals:read'];
    await TestBed.configureTestingModule({
      imports: [Genealogy],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'dashboard/genealogy/:id', component: Genealogy },
          { path: 'dashboard/genealogy', component: Genealogy },
        ]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  async function fixture() {
    const h = await RouterTestingHarness.create('/dashboard/genealogy/a1'),
      http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/animals`)
      .flush({ items: [root], total: 1, offset: 0, limit: 100 });
    http.expectOne((r) => r.url === `${url}/animals/a1/genealogy`).flush(family);
    await expect
      .poll(() => {
        h.detectChanges();
        return h.routeNativeElement?.textContent;
      })
      .toContain('Estrella');
    return h;
  }
  it('renders maternal links, missing relatives, direct children and their profiles', async () => {
    const h = await fixture();
    expect(h.routeNativeElement?.textContent).toContain('Abuela materna');
    expect(h.routeNativeElement?.textContent).toContain('No registrado');
    expect(h.routeNativeElement?.querySelectorAll('[data-child-node]').length).toBe(1);
    const b = h.routeNativeElement?.querySelector(
      'button[aria-label="Ver ficha de Abuela"]',
    ) as HTMLButtonElement;
    b.click();
    h.detectChanges();
    expect(h.routeNativeElement?.querySelector('app-modal')?.textContent).toContain('Abuela');
  });
  it('re-centers the tree when following a relative', async () => {
    const h = await fixture();
    (
      h.routeNativeElement?.querySelector(
        'a[aria-label="Ver genealogía de Madre"]',
      ) as HTMLAnchorElement
    ).click();
    await expect.poll(() => TestBed.inject(Router).url).toBe('/dashboard/genealogy/m1');
    const http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    http
      .expectOne((r) => r.url === `${url}/animals/m1/genealogy`)
      .flush({ ...family, tree: node(mother, node(grandma)), children: [root] });
    await expect
      .poll(() => {
        h.detectChanges();
        return h.routeNativeElement?.querySelector('[data-testid=genealogy-root]')?.textContent;
      })
      .toContain('Madre');
  });
  it('retains the chosen animal after searching options without dropping the selection', async () => {
    const h = await fixture(),
      http = TestBed.inject(HttpTestingController),
      url = TestBed.inject(API_URL);
    const input = h.routeNativeElement?.querySelector('#genealogy-search') as HTMLInputElement;
    input.value = 'Trueno';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    h.routeNativeElement
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true }));
    const req = http.expectOne((r) => r.url === `${url}/animals`);
    expect(req.request.params.get('q')).toBe('Trueno');
    req.flush({ items: [], total: 0, offset: 0, limit: 100 });
    await expect
      .poll(() => {
        h.detectChanges();
        return h.routeNativeElement?.querySelector('#genealogy-animal option[value=a1]')
          ?.textContent;
      })
      .toContain('Luna');
  });
  it('does not request genealogy without read permission', async () => {
    permissions = [];
    const h = await RouterTestingHarness.create('/dashboard/genealogy/a1');
    h.detectChanges();
    expect(h.routeNativeElement?.textContent).toContain('No tienes permiso');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
