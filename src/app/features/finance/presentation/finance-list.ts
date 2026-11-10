import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AllocationEditor } from './allocation-editor';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2, Eye } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { FinanceRepository } from '../infrastructure/finance-repository';
import {
  Category,
  IncomeAnimal,
  Kind,
  MoneyRecord,
  Page,
  Sale,
  SaleWeight,
  Summary,
  Supplier,
  Tab,
  categoryLabel,
  saleLabel,
} from '../domain/finance';
@Component({
  selector: 'app-finance-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    LucideAngularModule,
    Modal,
    RouterLink,
    AllocationEditor,
  ],
  templateUrl: './finance-list.html',
})
export class FinanceList implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(Session);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly repo = inject(FinanceRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'finance:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'finance:write'),
  );
  protected readonly tab = signal<Tab>('expenses');
  protected readonly categoryKind = signal<Kind>('expense');
  protected readonly categories = signal<Record<Kind, Category[]>>({ expense: [], income: [] });
  protected readonly moneyPage = signal<Page<MoneyRecord>>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly supplierPage = signal<Page<Supplier>>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly summary = signal<Summary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly busy = signal(false);
  protected readonly modal = signal<'money' | 'supplier' | 'category' | null>(null);
  protected readonly formKind = signal<Kind>('expense');
  protected readonly editingMoney = signal<MoneyRecord | null>(null);
  protected readonly editingSupplier = signal<Supplier | null>(null);
  protected readonly editingCategory = signal<Category | null>(null);
  protected readonly deletingCategory = signal<Category | null>(null);
  protected readonly deleteKind = signal<Kind>('expense');
  protected readonly formError = signal('');
  protected readonly detail = signal<MoneyRecord | null>(null);
  protected readonly allocating = signal<MoneyRecord | null>(null);
  protected allocationSaved() {
    this.allocating.set(null);
    this.success.set('Asignación del gasto guardada.');
    void this.load();
  }
  protected readonly supplierOptions = signal<Supplier[]>([]);
  protected readonly saleOptions = signal<Sale[]>([]);
  protected readonly optionQuery = signal('');
  protected readonly optionLoading = signal(false);
  protected readonly optionReady = signal(false);
  protected readonly plus = Plus;
  protected readonly pencil = Pencil;
  protected readonly trash = Trash2;
  protected readonly eye = Eye;
  protected readonly categoryLabel = categoryLabel;
  protected readonly saleLabel = saleLabel;
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected readonly filters = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    category_id: [0],
    date_from: [''],
    date_to: [''],
    active: [''],
  });
  protected readonly moneyForm = this.fb.nonNullable.group({
    category_id: [0, Validators.min(1)],
    amount: [
      '',
      [
        Validators.required,
        Validators.min(0.01),
        Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
    date: [this.today, Validators.required],
    description: ['', Validators.maxLength(5000)],
    supplier_id: [''],
    exit_event_id: [''],
    animal_id: [''],
    pricing_mode: ['total' as 'total' | 'per_kg'],
    weight_event_id: [''],
    price_per_kg: [''],
  });
  protected readonly supplierForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(190)]],
    address: ['', Validators.maxLength(5000)],
    active: [true],
  });
  protected readonly categoryName = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/\S/),
    Validators.maxLength(80),
  ]);
  protected readonly weights = signal<SaleWeight[]>([]);
  protected readonly weightsLoading = signal(false);
  protected readonly weightsError = signal('');
  private weightsRequest = 0;
  protected perKg() {
    return this.formKind() === 'income' && this.moneyForm.controls.pricing_mode.value === 'per_kg';
  }
  protected preview() {
    const v = this.moneyForm.getRawValue();
    const w = this.weights().find((w) => w.id === v.weight_event_id);
    if (!w || !/^\d+(\.\d{1,2})?$/.test(String(v.price_per_kg)) || Number(v.price_per_kg) <= 0)
      return null;
    const hundredths = (s: string) => {
      const [whole, fraction = ''] = String(s).split('.');
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    };
    const cents = (hundredths(w.weight_kg) * hundredths(v.price_per_kg) + 50n) / 100n;
    return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  }
  protected async changePricing(resetWeight = true) {
    const f = this.moneyForm.controls;
    if (this.perKg()) f.amount.disable();
    else f.amount.enable();
    f.price_per_kg.setValidators(
      this.perKg()
        ? [
            Validators.required,
            Validators.min(0.01),
            Validators.max(9999999999.99),
            Validators.pattern(/^\d+(\.\d{1,2})?$/),
          ]
        : [],
    );
    f.weight_event_id.setValidators(this.perKg() ? [Validators.required] : []);
    f.price_per_kg.updateValueAndValidity();
    f.weight_event_id.updateValueAndValidity();
    if (resetWeight) f.weight_event_id.setValue('');
    const n = ++this.weightsRequest;
    this.weights.set([]);
    this.weightsError.set('');
    this.weightsLoading.set(false);
    if (!this.perKg() || !f.exit_event_id.value) return;
    this.weightsLoading.set(true);
    try {
      const options = await this.repo.saleWeights(f.exit_event_id.value);
      if (n === this.weightsRequest && !this.destroyed) this.weights.set(options);
    } catch (e) {
      if (n === this.weightsRequest && !this.destroyed)
        this.weightsError.set(apiError(e, 'No se pudieron consultar los pesajes de salida.'));
    } finally {
      if (n === this.weightsRequest && !this.destroyed) this.weightsLoading.set(false);
    }
  }
  protected readonly directAnimalOpen = signal(false);
  protected readonly incomeAnimals = signal<IncomeAnimal[]>([]);
  protected readonly animalQuery = signal('');
  protected readonly animalLoading = signal(false);
  protected readonly animalError = signal('');
  private animalRequest = 0;
  protected async findIncomeAnimals() {
    const n = ++this.animalRequest;
    this.animalLoading.set(true);
    this.animalError.set('');
    try {
      const items = await firstValueFrom(
        this.http
          .get<IncomeAnimal[]>(`${this.api}/finance/allocation-options`, {
            params: { kind: 'animal', q: this.animalQuery() },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.animalRequest && !this.destroyed) {
        const selected = this.incomeAnimals().find(
          (a) => a.id === this.moneyForm.controls.animal_id.value,
        );
        this.incomeAnimals.set(
          selected && !items.some((a) => a.id === selected.id) ? [selected, ...items] : items,
        );
      }
    } catch (e) {
      if (n === this.animalRequest && !this.destroyed)
        this.animalError.set(apiError(e, 'No se pudieron consultar los animales.'));
    } finally {
      if (n === this.animalRequest && !this.destroyed) this.animalLoading.set(false);
    }
  }
  protected toggleIncomeAnimal() {
    this.directAnimalOpen.update((v) => !v);
    if (this.directAnimalOpen()) void this.findIncomeAnimals();
    else {
      this.animalRequest++;
      this.moneyForm.controls.animal_id.setValue('');
    }
  }
  protected saleChanged() {
    this.animalRequest++;
    this.moneyForm.controls.animal_id.setValue('');
    this.directAnimalOpen.set(false);
    void this.changePricing();
  }
  private request = 0;
  private optionsRequest = 0;
  private destroyed = false;
  ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get('income_id');
    if (id) this.tab.set('incomes');
    void this.load().then(() => {
      if (id && this.canRead() && !this.destroyed) void this.requestedIncome(id);
    });
  }
  private async requestedIncome(id: string) {
    try {
      const record = await firstValueFrom(
        this.http.get<MoneyRecord>(`${this.api}/finance/incomes/${id}`).pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      if (this.canWrite()) this.openMoney(record);
      else this.detail.set(record);
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo consultar el ingreso.'));
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.animalRequest++;
    this.weightsRequest++;
    this.request++;
    this.optionsRequest++;
  }
  protected async switchTab(tab: Tab) {
    this.tab.set(tab);
    this.filters.controls.category_id.setValue(0);
    this.filters.controls.q.setValue('');
    await this.load();
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed) return;
    const v = this.filters.getRawValue();
    if (v.date_from && v.date_to && v.date_from > v.date_to) {
      this.error.set('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const tab = this.tab();
      const [expense, income] = await Promise.all([
        this.repo.categories('expense'),
        this.repo.categories('income'),
      ]);
      if (request !== this.request) return;
      this.categories.set({ expense, income });
      if (tab === 'expenses' || tab === 'incomes') {
        const [page, summary] = await Promise.all([
          this.repo.money(tab === 'expenses' ? 'expense' : 'income', {
            ...v,
            q: v.q.trim(),
            offset,
          }),
          this.repo.summary(v.date_from, v.date_to),
        ]);
        if (request === this.request) {
          this.moneyPage.set(page);
          this.summary.set(summary);
        }
      } else if (tab === 'suppliers') {
        const page = await this.repo.suppliers(v.q.trim(), v.active, offset);
        if (request === this.request) this.supplierPage.set(page);
      }
    } catch (e) {
      if (request === this.request) this.error.set(apiError(e, 'No se pudo cargar Economía.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected openMoney(record: MoneyRecord | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.formKind.set(this.tab() === 'incomes' ? 'income' : 'expense');
    this.editingMoney.set(record);
    this.animalRequest++;
    this.directAnimalOpen.set(!!record?.animal && !record?.sale);
    this.incomeAnimals.set(record?.animal ? [record.animal] : []);
    this.animalQuery.set('');
    this.animalError.set('');
    this.animalLoading.set(false);
    this.formError.set('');
    this.optionQuery.set('');
    this.optionReady.set(false);
    this.supplierOptions.set([]);
    this.saleOptions.set([]);
    this.moneyForm.controls.amount.setValidators([
      Validators.required,
      Validators.min(this.formKind() === 'expense' ? 0.01 : 0),
      Validators.max(9999999999.99),
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]);
    this.moneyForm.controls.amount.enable();
    this.moneyForm.reset({
      category_id: record?.category.id ?? 0,
      amount: record?.amount ?? '',
      date: record?.date ?? this.today,
      description: record?.description ?? '',
      supplier_id: record?.supplier?.id ?? '',
      exit_event_id: record?.sale?.id ?? '',
      animal_id: record?.sale ? '' : (record?.animal?.id ?? ''),
      pricing_mode: record?.sale_pricing ? 'per_kg' : 'total',
      weight_event_id: record?.sale_pricing?.weight_event_id ?? '',
      price_per_kg: record?.sale_pricing?.price_per_kg ?? '',
    });
    void this.changePricing(false);
    this.modal.set('money');
    void this.loadOptions();
  }
  protected openSupplier(supplier: Supplier | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editingSupplier.set(supplier);
    this.formError.set('');
    this.supplierForm.reset({
      name: supplier?.name ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      address: supplier?.address ?? '',
      active: supplier?.active ?? true,
    });
    this.modal.set('supplier');
  }
  protected openCategory(category: Category | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editingCategory.set(category);
    this.formKind.set(this.categoryKind());
    this.formError.set('');
    this.categoryName.setValue(category?.name ?? '');
    this.modal.set('category');
  }
  protected closeForm() {
    if (!this.busy()) {
      this.optionsRequest++;
      this.animalRequest++;
      this.weightsRequest++;
      this.modal.set(null);
    }
  }
  protected async loadOptions() {
    const request = ++this.optionsRequest;
    this.optionLoading.set(true);
    this.formError.set('');
    try {
      if (this.formKind() === 'expense') {
        const result = await this.repo.suppliers(this.optionQuery().trim(), 'true', 0, 100);
        if (request === this.optionsRequest) {
          const selected =
            this.supplierOptions().find(
              (s) => s.id === this.moneyForm.controls.supplier_id.value,
            ) ?? this.editingMoney()?.supplier;
          this.supplierOptions.set(
            selected && !result.items.some((s) => s.id === selected.id)
              ? [selected, ...result.items]
              : result.items,
          );
        }
      } else {
        const sales = await this.repo.sales(this.optionQuery().trim(), this.editingMoney()?.id);
        if (request === this.optionsRequest) {
          const selected =
            this.saleOptions().find((s) => s.id === this.moneyForm.controls.exit_event_id.value) ??
            this.editingMoney()?.sale;
          this.saleOptions.set(
            selected && !sales.some((s) => s.id === selected.id) ? [selected, ...sales] : sales,
          );
        }
      }
      if (request === this.optionsRequest) this.optionReady.set(true);
    } catch (e) {
      if (request === this.optionsRequest) {
        this.optionReady.set(false);
        this.formError.set(apiError(e, 'No se pudieron cargar las opciones.'));
      }
    } finally {
      if (request === this.optionsRequest) this.optionLoading.set(false);
    }
  }
  protected async saveMoney() {
    this.moneyForm.markAllAsTouched();
    if (this.moneyForm.invalid || this.busy() || !this.canWrite() || !this.optionReady()) return;
    const v = this.moneyForm.getRawValue();
    if (v.date > this.today) {
      this.formError.set('La fecha no puede ser futura.');
      return;
    }
    if (
      this.perKg() &&
      (!v.exit_event_id ||
        this.weightsLoading() ||
        this.weightsError() ||
        !this.weights().some((w) => w.id === v.weight_event_id) ||
        this.preview() === null)
    ) {
      this.formError.set(
        'Selecciona la venta, un pesaje del día de salida y un precio por kilogramo válido.',
      );
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const input = {
        category_id: v.category_id,
        ...(this.perKg()
          ? {
              pricing_mode: 'per_kg' as const,
              weight_event_id: v.weight_event_id,
              price_per_kg: String(v.price_per_kg),
            }
          : { amount: String(v.amount) }),
        date: v.date,
        description: v.description.trim() || null,
        ...(this.formKind() === 'expense'
          ? { supplier_id: v.supplier_id || null }
          : {
              exit_event_id: v.exit_event_id || null,
              ...(!v.exit_event_id && v.animal_id ? { animal_id: v.animal_id } : {}),
            }),
      };
      const saved = await this.repo.saveMoney(this.formKind(), input, this.editingMoney()?.id);
      if (this.destroyed) return;
      this.optionsRequest++;
      this.animalRequest++;
      this.weightsRequest++;
      this.modal.set(null);
      this.success.set(this.formKind() === 'expense' ? 'Gasto guardado.' : 'Ingreso guardado.');
      await this.load();
      this.detail.set(saved);
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar el movimiento.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async saveSupplier() {
    this.supplierForm.markAllAsTouched();
    if (this.supplierForm.invalid || this.busy() || !this.canWrite()) return;
    const v = this.supplierForm.getRawValue();
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.saveSupplier(
        {
          ...v,
          name: v.name.trim(),
          phone: v.phone.trim() || null,
          email: v.email.trim() || null,
          address: v.address.trim() || null,
        },
        this.editingSupplier()?.id,
      );
      if (this.destroyed) return;
      this.modal.set(null);
      this.success.set('Proveedor guardado.');
      await this.load();
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar el proveedor.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async saveCategory() {
    this.categoryName.markAsTouched();
    if (this.categoryName.invalid || this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.saveCategory(
        this.formKind(),
        this.categoryName.value.trim(),
        this.editingCategory()?.id,
      );
      if (this.destroyed) return;
      this.modal.set(null);
      this.success.set('Categoría guardada.');
      await this.load();
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo guardar la categoría.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected askDelete(category: Category) {
    if (!this.canWrite() || this.busy()) return;
    this.deleteKind.set(this.categoryKind());
    this.deletingCategory.set(category);
    this.formError.set('');
  }
  protected async deleteCategory() {
    const category = this.deletingCategory();
    if (!category || this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.deleteCategory(this.deleteKind(), category.id);
      if (this.destroyed) return;
      this.deletingCategory.set(null);
      this.success.set('Categoría eliminada.');
      await this.load();
    } catch (e) {
      if (!this.destroyed) this.formError.set(apiError(e, 'No se pudo eliminar la categoría.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
