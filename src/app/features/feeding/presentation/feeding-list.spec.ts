import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Session, SessionUser } from "../../../core/auth/session";
import { API_URL } from "../../../core/http/api-url";
import { authInterceptor } from "../../../core/http/auth.interceptor";
import { FeedingRepository } from "../infrastructure/feeding-repository";
import { FeedingList } from "./feeding-list";
const USER: SessionUser = {
  id: "owner",
  name: "Cris",
  middle_name: null,
  paternal_lastname: "Ozuna",
  maternal_lastname: "Vazquez",
  email: "owner@example.com",
  phone: null,
  active: true,
  role_id: "owner-role",
  role_name: "owner",
  permissions: ["feeding:read", "feeding:write"],
};
let http: HttpTestingController, api: string;
function element(f: ComponentFixture<FeedingList>): HTMLElement {
  return f.nativeElement;
}
function click(f: ComponentFixture<FeedingList>, selector: string) {
  element(f).querySelector<HTMLButtonElement>(selector)!.click();
  f.detectChanges();
}
function fill(f: ComponentFixture<FeedingList>, id: string, value: string) {
  const el = element(f).querySelector<HTMLInputElement | HTMLSelectElement>(
    `#${id}`,
  )!;
  el.value = value;
  el.dispatchEvent(
    new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
  );
  f.detectChanges();
}
async function login(permissions = USER.permissions) {
  const pending = TestBed.inject(Session).login(USER.email, "Test-password123");
  http.expectOne(`${api}/auth/login`).flush({
    expires_in: 1800,
    user: { ...USER, permissions },
  });
  await pending;
}

const FEED = {
  id: "f1",
  name: "Alimento para ovinos",
  unit_id: 2,
  unit_code: "kg",
  current_unit_cost: "8.5000",
  current_price_from: "2024-01-01",
};
const ANIMAL = { id: "a1", name: "Luna", siniiga: "MX1" };
const GROUP = { id: "g1", name: "Reproductoras", siniiga: null };
const RECORD = {
  id: "c1",
  feed: FEED,
  animal: ANIMAL,
  group: null,
  date: "2024-06-01",
  quantity: "1.25",
  unit_cost: "10.1250",
  price_from: "2024-01-01",
  cost: "12.66",
};
const page = (items: unknown[] = []) => ({
  items,
  total: items.length,
  offset: 0,
  limit: 25,
  total_cost: "12.66",
  unpriced_count: 0,
});
async function fixture() {
  const f = TestBed.createComponent(FeedingList);
  f.detectChanges();
  http.expectOne((r) => r.url === `${api}/feeding/consumptions`).flush(page());
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).textContent;
    })
    .toContain("No hay consumos");
  return f;
}
function submit(f: ComponentFixture<FeedingList>) {
  element(f)
    .querySelector("dialog form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  f.detectChanges();
}
async function flushOptions(
  f: ComponentFixture<FeedingList>,
  target: { id: string; name: string; siniiga: string | null } = ANIMAL,
) {
  http
    .expectOne((r) => r.url === `${api}/feeding/feeds`)
    .flush({ items: [FEED], total: 1, offset: 0, limit: 100 });
  http
    .expectOne((r) => r.url === `${api}/feeding/target-options`)
    .flush([target]);
  await expect
    .poll(() => {
      f.detectChanges();
      return element(f).querySelector<HTMLSelectElement>("#consumption-target")
        ?.options.length;
    })
    .toBe(2);
}
describe("Feeding", () => {
  beforeEach(async () => {
    sessionStorage.removeItem("pelifolk-session");
    await TestBed.configureTestingModule({
      imports: [FeedingList],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        FeedingRepository,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(API_URL);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem("pelifolk-session");
  });
  it("respects access and does not expose writes to readers", async () => {
    await login([]);
    const denied = TestBed.createComponent(FeedingList);
    denied.detectChanges();
    http.expectNone((r) => r.url.includes("/feeding"));
    expect(element(denied).textContent).toContain("No tienes permiso");
    denied.destroy();
    await login(["feeding:read"]);
    const f = await fixture();
    expect(element(f).querySelector("[data-testid=new-feeding]")).toBeNull();
  });
  it("posts a consumption for a single animal and opens its cost detail", async () => {
    await login();
    const f = await fixture();
    click(f, "[data-testid=new-feeding]");
    await flushOptions(f);
    fill(f, "consumption-feed", "f1");
    fill(f, "consumption-target", "a1");
    fill(f, "consumption-date", "2024-06-01");
    fill(f, "consumption-quantity", "1.25");
    submit(f);
    const req = http.expectOne(`${api}/feeding/consumptions`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({
      feed_id: "f1",
      animal_id: "a1",
      group_id: null,
      date: "2024-06-01",
      quantity: "1.25",
    });
    req.flush(RECORD);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/feeding/consumptions`)
            .map((r) => {
              r.flush(page([RECORD]));
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector("dialog")?.textContent;
      })
      .toContain("Precio vigente");
  });
  it("switches to a group without retaining the animal selection and keeps errors visible", async () => {
    await login();
    const f = await fixture();
    click(f, "[data-testid=new-feeding]");
    await flushOptions(f);
    fill(f, "consumption-target", "a1");
    fill(f, "consumption-kind", "group");
    await flushOptions(f, GROUP);
    expect(
      element(f).querySelector<HTMLSelectElement>("#consumption-target")?.value,
    ).toBe("");
    fill(f, "consumption-feed", "f1");
    fill(f, "consumption-target", "g1");
    fill(f, "consumption-date", "2024-06-01");
    fill(f, "consumption-quantity", "5.5");
    submit(f);
    const req = http.expectOne(`${api}/feeding/consumptions`);
    expect(req.request.body.group_id).toBe("g1");
    expect(req.request.body.animal_id).toBeNull();
    req.flush(
      { detail: "Feed has no price on feeding date" },
      { status: 422, statusText: "Unprocessable Entity" },
    );
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector("[role=alert]")?.textContent;
      })
      .toContain("Registra un precio");
  });
  it("creates the food and initial price in one request and closes the modal", async () => {
    await login();
    const f = await fixture();
    click(f, "[data-tab=feeds]");
    http
      .expectOne((r) => r.url === `${api}/feeding/feeds`)
      .flush({ items: [], total: 0, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).textContent;
      })
      .toContain("No hay alimentos");
    click(f, "[data-testid=new-feeding]");
    http.expectOne(`${api}/feeding/units`).flush([{ id: 2, code: "kg" }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector<HTMLSelectElement>("#feed-unit")
          ?.options.length;
      })
      .toBe(2);
    fill(f, "feed-name", "Alimento para ovinos");
    const unit = element(f).querySelector<HTMLSelectElement>("#feed-unit")!;
    unit.selectedIndex = 1;
    unit.dispatchEvent(new Event("change", { bubbles: true }));
    f.detectChanges();
    submit(f);
    http.expectNone((r) => r.method === "POST");
    fill(f, "initial-price-date", "2024-01-01");
    fill(f, "initial-price-cost", "8.5");
    submit(f);
    const req = http.expectOne(`${api}/feeding/feeds`);
    expect(req.request.body).toEqual({
      name: FEED.name,
      unit_id: 2,
      initial_price: { effective_from: "2024-01-01", unit_cost: "8.5" },
    });
    req.flush(FEED);
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/feeding/feeds`)
            .map((r) => {
              r.flush({ items: [FEED], total: 1, offset: 0, limit: 25 });
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector("dialog");
      })
      .toBeNull();
    http.expectNone(`${api}/feeding/feeds/f1/prices`);
  });
  it("adds a dated price and loads its history", async () => {
    await login();
    const f = await fixture();
    click(f, "[data-tab=feeds]");
    http
      .expectOne((r) => r.url === `${api}/feeding/feeds`)
      .flush({ items: [FEED], total: 1, offset: 0, limit: 25 });
    await expect
      .poll(() => {
        f.detectChanges();
        return !!element(f).querySelector("[data-feed-id]");
      })
      .toBe(true);
    click(f, 'button[aria-label^="Precios de"]');
    http.expectOne(`${api}/feeding/feeds/f1/prices`).flush([]);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector("dialog")?.textContent;
      })
      .toContain("Todavía no hay precios");
    fill(f, "feed-price-date", "2024-01-01");
    fill(f, "feed-price-cost", "10.125");
    submit(f);
    const req = http.expectOne(`${api}/feeding/feeds/f1/prices`);
    expect(req.request.body).toEqual({
      effective_from: "2024-01-01",
      unit_cost: "10.125",
    });
    req.flush({ effective_from: "2024-01-01", unit_cost: "10.1250" });
    await expect
      .poll(
        () =>
          http
            .match((r) => r.url === `${api}/feeding/feeds/f1/prices`)
            .map((r) => {
              r.flush([{ effective_from: "2024-01-01", unit_cost: "10.1250" }]);
              return true;
            }).length,
      )
      .toBe(1);
    await expect
      .poll(() => {
        f.detectChanges();
        return element(f).querySelector("dialog ol")?.textContent;
      })
      .toContain("10.125");
    http
      .expectOne((r) => r.url === `${api}/feeding/feeds`)
      .flush({ items: [FEED], total: 1, offset: 0, limit: 25 });
  });
});
