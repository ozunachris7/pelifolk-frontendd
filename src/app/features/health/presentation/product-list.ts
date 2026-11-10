import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ProductPrices } from './product-prices';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, X, Coins } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { HealthRepository } from '../infrastructure/health-repository';
import { CatalogItem, Page, Product, TreatmentCatalogs, catalogLabel } from '../domain/health';
import { HealthNav } from './health-nav';
@Component({
  selector: 'app-product-list',
  imports: [
    DatePipe,
    CurrencyPipe,
    ProductPrices,
    ReactiveFormsModule,
    LucideAngularModule,
    Modal,
    HealthNav,
  ],
  templateUrl: './product-list.html',
})
export class ProductList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(HealthRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'health:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'health:products:write'),
  );
  protected readonly canPriceRead = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'finance:read'),
  );
  protected readonly canPriceWrite = computed(
    () => this.canPriceRead() && hasPermission(this.session.user(), 'finance:write'),
  );
  protected readonly coins = Coins;
  protected readonly pricing = signal<Product | null>(null);
  protected readonly withInitialPrice = signal(false);
  protected readonly initialPrice = this.fb.nonNullable.group({
    effective_from: [this.today(), Validators.required],
    cost: [
      '',
      [
        Validators.required,
        Validators.min(0),
        Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
  });
  protected today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  protected priceSaved() {
    this.success.set('Precio registrado.');
    void this.load(this.page().offset);
  }
  protected readonly page = signal<Page<Product>>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly search = signal('');
  protected readonly status = signal('active');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly editing = signal<Product | null>(null);
  protected readonly catalogs = signal<TreatmentCatalogs | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly label = catalogLabel;
  protected readonly plus = Plus;
  protected readonly pencil = Pencil;
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    product_type_id: [0, Validators.min(1)],
    unit_id: [0, Validators.min(1)],
    withdrawal_days: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(2147483647),
        Validators.pattern(/^\d+$/),
      ],
    ],
    active: [true],
  });
  protected readonly removeIcon = X;
  protected readonly ingredientOptions = signal<CatalogItem[]>([]);
  protected readonly selectedIngredients = signal<CatalogItem[]>([]);
  protected readonly ingredientQuery = signal('');
  protected readonly ingredientTotal = signal(0);
  protected readonly ingredientLoading = signal(false);
  protected readonly ingredientError = signal('');
  protected readonly ingredientSaving = signal(false);
  protected readonly ingredientName = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/\S/),
    Validators.maxLength(120),
  ]);
  private ingredientRequest = 0;
  protected selected(id: number) {
    return this.selectedIngredients().some((i) => i.id === id);
  }
  protected toggleIngredient(item: CatalogItem) {
    if (this.busy() || this.ingredientSaving()) return;
    this.selectedIngredients.update((items) =>
      this.selected(item.id) ? items.filter((i) => i.id !== item.id) : [...items, item],
    );
  }
  protected async findIngredients() {
    const n = ++this.ingredientRequest;
    this.ingredientLoading.set(true);
    this.ingredientError.set('');
    try {
      const p = await this.repo.ingredients(this.ingredientQuery().trim(), 0, 50);
      if (n === this.ingredientRequest && !this.destroyed) {
        this.ingredientOptions.set(p.items);
        this.ingredientTotal.set(p.total);
      }
    } catch (e) {
      if (n === this.ingredientRequest && !this.destroyed)
        this.ingredientError.set(apiError(e, 'No se pudieron consultar los principios activos.'));
    } finally {
      if (n === this.ingredientRequest && !this.destroyed) this.ingredientLoading.set(false);
    }
  }
  protected async addIngredient() {
    this.ingredientName.markAsTouched();
    if (!this.canWrite() || this.busy() || this.ingredientSaving() || this.ingredientName.invalid)
      return;
    this.ingredientSaving.set(true);
    this.ingredientError.set('');
    try {
      const item = await this.repo.saveIngredient(this.ingredientName.value.trim());
      if (!this.destroyed) {
        this.selectedIngredients.update((items) => [...items, item]);
        this.ingredientName.reset();
        this.ingredientQuery.set('');
        await this.findIngredients();
      }
    } catch (e) {
      if (!this.destroyed)
        this.ingredientError.set(apiError(e, 'No se pudo agregar el principio activo.'));
    } finally {
      if (!this.destroyed) this.ingredientSaving.set(false);
    }
  }
  private request = 0;
  private formRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.ingredientRequest++;
    this.request++;
    this.formRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.repo.products(
        this.search().trim(),
        this.status() === 'all' ? null : this.status() === 'active',
        offset,
      );
      if (request === this.request) this.page.set(page);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudieron cargar los productos.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected async openForm(product: Product | null = null) {
    if (!this.canWrite() || this.busy() || this.ingredientSaving()) return;
    const request = ++this.formRequest;
    this.editing.set(product);
    this.withInitialPrice.set(false);
    this.initialPrice.reset({ effective_from: this.today(), cost: '' });
    this.selectedIngredients.set(product?.ingredients ?? []);
    this.ingredientOptions.set([]);
    this.ingredientQuery.set('');
    this.ingredientName.reset();
    this.formError.set('');
    this.catalogs.set(null);
    this.catalogLoading.set(true);
    this.form.reset({
      name: product?.name ?? '',
      product_type_id: product?.product_type_id ?? 0,
      unit_id: product?.unit_id ?? 0,
      withdrawal_days: product?.withdrawal_days ?? 0,
      active: product?.active ?? true,
    });
    this.formOpen.set(true);
    void this.findIngredients();
    try {
      const catalogs = await this.repo.catalogs();
      if (request === this.formRequest) this.catalogs.set(catalogs);
    } catch (error) {
      if (request === this.formRequest)
        this.formError.set(
          apiError(
            error,
            'No se pudieron cargar los catálogos. Cierra y vuelve a abrir el formulario.',
          ),
        );
    } finally {
      if (request === this.formRequest) this.catalogLoading.set(false);
    }
  }
  protected closeForm() {
    if (!this.busy() && !this.ingredientSaving()) {
      this.ingredientRequest++;
      this.formRequest++;
      this.formOpen.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (
      !this.canWrite() ||
      this.busy() ||
      this.ingredientSaving() ||
      this.form.invalid ||
      !this.catalogs()
    )
      return;
    if (this.withInitialPrice() && !this.editing()) {
      this.initialPrice.markAllAsTouched();
      if (!this.canPriceWrite() || this.initialPrice.invalid) {
        this.formError.set('Completa la fecha y el costo por unidad con hasta dos decimales.');
        return;
      }
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const data = this.form.getRawValue();
      await this.repo.saveProduct(
        {
          ...data,
          name: data.name.trim(),
          ingredient_ids: this.selectedIngredients().map((i) => i.id),
          ...(this.withInitialPrice() && !this.editing()
            ? {
                initial_price: {
                  effective_from: this.initialPrice.controls.effective_from.value,
                  cost: String(this.initialPrice.controls.cost.value),
                },
              }
            : {}),
        },
        this.editing()?.id,
      );
      if (this.destroyed) return;
      this.ingredientRequest++;
      this.formOpen.set(false);
      this.success.set(this.editing() ? 'Producto actualizado.' : 'Producto registrado.');
      await this.load();
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar el producto.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
