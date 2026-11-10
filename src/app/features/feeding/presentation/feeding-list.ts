import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { CurrencyPipe, DatePipe, DecimalPipe } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  LucideAngularModule,
  Plus,
  Pencil,
  History,
  Coins,
  Eye,
} from "lucide-angular";
import { Session } from "../../../core/auth/session";
import { apiError } from "../../../core/http/api-error";
import { Modal } from "../../../shared/ui/modal/modal";
import { hasPermission } from "../../users/domain/access";
import { FeedingRepository } from "../infrastructure/feeding-repository";
import {
  Consumption,
  ConsumptionPage,
  Feed,
  Page,
  Price,
  Target,
  TargetKind,
  Unit,
  targetLabel,
  unitLabel,
} from "../domain/feeding";
@Component({
  selector: "app-feeding-list",
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    LucideAngularModule,
    Modal,
  ],
  templateUrl: "./feeding-list.html",
})
export class FeedingList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(FeedingRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() =>
    hasPermission(this.session.user(), "feeding:read"),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), "feeding:write"),
  );
  protected readonly tab = signal<"consumptions" | "feeds">("consumptions");
  protected readonly consumptionPage = signal<ConsumptionPage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
    total_cost: "0.00",
    unpriced_count: 0,
  });
  protected readonly feedPage = signal<Page<Feed>>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly historyTarget = signal<{
    kind: TargetKind;
    target: Target;
  } | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal("");
  protected readonly success = signal("");
  protected readonly busy = signal(false);
  protected readonly modal = signal<"feed" | "consumption" | null>(null);
  protected readonly formError = signal("");
  protected readonly optionsLoading = signal(false);
  protected readonly optionsReady = signal(false);
  protected readonly editingFeed = signal<Feed | null>(null);
  protected readonly units = signal<Unit[]>([]);
  protected readonly feedOptions = signal<Feed[]>([]);
  protected readonly targets = signal<Target[]>([]);
  protected readonly feedSearch = signal("");
  protected readonly targetSearch = signal("");
  protected readonly pricesFeed = signal<Feed | null>(null);
  protected readonly prices = signal<Price[]>([]);
  protected readonly pricesLoading = signal(false);
  protected readonly priceError = signal("");
  protected readonly detail = signal<Consumption | null>(null);
  protected readonly plus = Plus;
  protected readonly pencil = Pencil;
  protected readonly clock = History;
  protected readonly coins = Coins;
  protected readonly eye = Eye;
  protected readonly unitLabel = unitLabel;
  protected readonly label = targetLabel;
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  protected readonly search = this.fb.nonNullable.group({
    q: ["", Validators.maxLength(100)],
    date_from: [""],
    date_to: [""],
  });
  protected readonly feedForm = this.fb.nonNullable.group({
    name: [
      "",
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(150),
      ],
    ],
    unit_id: [0, Validators.min(1)],
  });
  protected readonly priceForm = this.fb.nonNullable.group({
    effective_from: [this.today, Validators.required],
    unit_cost: [
      "",
      [
        Validators.required,
        Validators.min(0),
        Validators.max(99999999.9999),
        Validators.pattern(/^\d+(\.\d{1,4})?$/),
      ],
    ],
  });
  protected readonly consumptionForm = this.fb.nonNullable.group({
    feed_id: ["", Validators.required],
    target_kind: ["animal" as TargetKind],
    target_id: ["", Validators.required],
    date: [this.today, Validators.required],
    quantity: [
      "",
      [
        Validators.required,
        Validators.min(0.01),
        Validators.max(99999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
  });
  protected readonly selectedFeed = computed(() =>
    this.feedOptions().find((f) => f.id === this.selectedFeedId()),
  );
  protected readonly selectedFeedId = signal("");
  private request = 0;
  private optionsRequest = 0;
  private pricesRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.optionsRequest++;
    this.pricesRequest++;
  }
  protected switchTab(tab: "feeds" | "consumptions") {
    this.tab.set(tab);
    this.search.controls.q.setValue("");
    void this.load();
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed) return;
    const v = this.search.getRawValue();
    if (v.date_from && v.date_to && v.date_from > v.date_to) {
      this.error.set("La fecha inicial no puede ser posterior a la final.");
      return;
    }
    const request = ++this.request;
    this.loading.set(true);
    this.error.set("");
    try {
      if (this.tab() === "feeds") {
        const p = await this.repo.feeds(v.q.trim(), offset);
        if (request === this.request) this.feedPage.set(p);
      } else {
        const h = this.historyTarget();
        const p = await this.repo.consumptions(
          v.q.trim(),
          v.date_from,
          v.date_to,
          offset,
          h ? { kind: h.kind, id: h.target.id } : undefined,
        );
        if (request === this.request) this.consumptionPage.set(p);
      }
    } catch (e) {
      if (request === this.request)
        this.error.set(apiError(e, "No se pudo cargar Alimentación."));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected history(kind: TargetKind, target: Target) {
    this.historyTarget.set({ kind, target });
    this.tab.set("consumptions");
    this.search.controls.q.setValue("");
    void this.load();
  }
  protected clearHistory() {
    this.historyTarget.set(null);
    void this.load();
  }
  protected async openFeed(feed: Feed | null = null) {
    if (!this.canWrite() || this.busy()) return;
    const request = ++this.optionsRequest;
    this.editingFeed.set(feed);
    this.feedForm.reset({
      name: feed?.name ?? "",
      unit_id: feed?.unit_id ?? 0,
    });
    this.priceForm.reset({ effective_from: this.today, unit_cost: "" });
    this.formError.set("");
    this.optionsReady.set(false);
    this.optionsLoading.set(true);
    this.units.set([]);
    this.modal.set("feed");
    try {
      const units = await this.repo.units();
      if (request === this.optionsRequest) {
        this.units.set(units);
        this.optionsReady.set(true);
      }
    } catch (e) {
      if (request === this.optionsRequest)
        this.formError.set(apiError(e, "No se pudieron cargar las unidades."));
    } finally {
      if (request === this.optionsRequest) this.optionsLoading.set(false);
    }
  }
  protected async saveFeed() {
    this.feedForm.markAllAsTouched();
    if (!this.editingFeed()) this.priceForm.markAllAsTouched();
    if (
      (!this.editingFeed() && this.priceForm.invalid) ||
      this.feedForm.invalid ||
      this.busy() ||
      !this.optionsReady() ||
      !this.canWrite()
    )
      return;
    this.busy.set(true);
    this.formError.set("");
    try {
      const v = this.feedForm.getRawValue();
      const price = this.priceForm.getRawValue();
      await this.repo.saveFeed(
        v.name.trim(),
        v.unit_id,
        this.editingFeed()?.id,
        this.editingFeed()
          ? undefined
          : {
              effective_from: price.effective_from,
              unit_cost: String(price.unit_cost),
            },
      );
      if (this.destroyed) return;
      this.modal.set(null);
      this.success.set("Alimento guardado.");
      await this.load();
    } catch (e) {
      if (!this.destroyed)
        this.formError.set(apiError(e, "No se pudo guardar el alimento."));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected openConsumption() {
    if (!this.canWrite() || this.busy()) return;
    this.consumptionForm.reset({
      feed_id: "",
      target_kind: "animal",
      target_id: "",
      date: this.today,
      quantity: "",
    });
    this.selectedFeedId.set("");
    this.feedSearch.set("");
    this.targetSearch.set("");
    this.targets.set([]);
    this.feedOptions.set([]);
    this.optionsReady.set(false);
    this.formError.set("");
    this.modal.set("consumption");
    void this.loadOptions();
  }
  protected targetChanged() {
    this.consumptionForm.controls.target_id.setValue("");
    this.targets.set([]);
    this.targetSearch.set("");
    void this.loadOptions();
  }
  protected async loadOptions() {
    const request = ++this.optionsRequest;
    this.optionsLoading.set(true);
    this.formError.set("");
    try {
      const [feeds, targets] = await Promise.all([
        this.repo.feeds(this.feedSearch().trim(), 0, 100),
        this.repo.targets(
          this.consumptionForm.controls.target_kind.value,
          this.targetSearch().trim(),
        ),
      ]);
      if (request === this.optionsRequest) {
        const selectedFeed = this.feedOptions().find(
          (f) => f.id === this.consumptionForm.controls.feed_id.value,
        );
        const selectedTarget = this.targets().find(
          (t) => t.id === this.consumptionForm.controls.target_id.value,
        );
        this.feedOptions.set(
          selectedFeed && !feeds.items.some((f) => f.id === selectedFeed.id)
            ? [selectedFeed, ...feeds.items]
            : feeds.items,
        );
        this.targets.set(
          selectedTarget && !targets.some((t) => t.id === selectedTarget.id)
            ? [selectedTarget, ...targets]
            : targets,
        );
        this.optionsReady.set(true);
      }
    } catch (e) {
      if (request === this.optionsRequest) {
        this.optionsReady.set(false);
        this.formError.set(
          apiError(e, "No se pudieron cargar alimentos y destinos."),
        );
      }
    } finally {
      if (request === this.optionsRequest) this.optionsLoading.set(false);
    }
  }
  protected closeForm() {
    if (!this.busy()) {
      this.optionsRequest++;
      this.modal.set(null);
    }
  }
  protected async saveConsumption() {
    this.consumptionForm.markAllAsTouched();
    if (
      this.consumptionForm.invalid ||
      this.busy() ||
      !this.optionsReady() ||
      !this.canWrite()
    )
      return;
    const v = this.consumptionForm.getRawValue();
    if (v.date > this.today) {
      this.formError.set("La fecha no puede ser futura.");
      return;
    }
    this.busy.set(true);
    this.formError.set("");
    try {
      const saved = await this.repo.create({
        feed_id: v.feed_id,
        animal_id: v.target_kind === "animal" ? v.target_id : null,
        group_id: v.target_kind === "group" ? v.target_id : null,
        date: v.date,
        quantity: String(v.quantity),
      });
      if (this.destroyed) return;
      this.optionsRequest++;
      this.modal.set(null);
      this.success.set("Consumo registrado.");
      await this.load();
      this.detail.set(saved);
    } catch (e) {
      if (!this.destroyed)
        this.formError.set(apiError(e, "No se pudo guardar el consumo."));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async openPrices(feed: Feed) {
    this.pricesFeed.set(feed);
    this.priceForm.reset({ effective_from: this.today, unit_cost: "" });
    await this.loadPrices();
  }
  protected async loadPrices() {
    const feed = this.pricesFeed();
    if (!feed) return;
    const request = ++this.pricesRequest;
    this.pricesLoading.set(true);
    this.priceError.set("");
    this.prices.set([]);
    try {
      const prices = await this.repo.prices(feed.id);
      if (request === this.pricesRequest) this.prices.set(prices);
    } catch (e) {
      if (request === this.pricesRequest)
        this.priceError.set(apiError(e, "No se pudieron cargar los precios."));
    } finally {
      if (request === this.pricesRequest) this.pricesLoading.set(false);
    }
  }
  protected closePrices() {
    if (!this.busy()) {
      this.pricesRequest++;
      this.pricesFeed.set(null);
    }
  }
  protected async savePrice() {
    const feed = this.pricesFeed();
    this.priceForm.markAllAsTouched();
    if (!feed || this.priceForm.invalid || this.busy() || !this.canWrite())
      return;
    this.busy.set(true);
    this.priceError.set("");
    try {
      const v = this.priceForm.getRawValue();
      await this.repo.addPrice(feed.id, v.effective_from, String(v.unit_cost));
      if (this.destroyed) return;
      this.priceForm.controls.unit_cost.setValue("");
      this.priceForm.markAsUntouched();
      await this.loadPrices();
      await this.load(this.feedPage().offset);
      this.success.set("Precio registrado.");
    } catch (e) {
      if (!this.destroyed)
        this.priceError.set(apiError(e, "No se pudo guardar el precio."));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
