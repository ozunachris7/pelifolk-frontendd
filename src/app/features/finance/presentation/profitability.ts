import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Eye, Pencil } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { AllocationEditor } from './allocation-editor';
import { MoneyRecord } from '../domain/finance';
import { ProfitAnimalSelect, ProfitAnimal } from './profit-animal-select';
import { exitLabel } from '../../exits/domain/exits';
interface Animal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
interface Row {
  animal: Animal;
  status: string;
  income: string;
  income_count: number;
  expenses: string;
  expense_count: number;
  direct_expenses: string;
  case_expenses: string;
  group_expenses: string;
  result: string;
  feeding?: {
    direct: string;
    group: string;
    known_cost: string;
    records: number;
    unpriced: number;
  };
  medicines?: { known_cost: string; applications: number; unpriced: number };
}
interface Page {
  as_of: string;
  items: Row[];
  total: number;
  offset: number;
  limit: number;
  activity?: { income_count: number; expense_count: number };
  summary: { income: string; expenses: string; result: string };
  coverage: {
    pending_expenses: string;
    pending_expense_count: number;
    pending_income: string;
    pending_income_count: number;
    status: string;
  };
}
interface Pending {
  items: {
    id: string;
    date: string;
    amount: string;
    pending_amount?: string;
    description: string | null;
    record: MoneyRecord;
  }[];
  total: number;
  offset: number;
  limit: number;
}
interface Entries {
  items: {
    id: string;
    date: string;
    title: string;
    amount: string | null;
    via: string;
    original_amount?: string;
    group_name?: string;
    unknown_reason?: string | null;
  }[];
  total: number;
  offset: number;
  limit: number;
}
type Section = 'incomes' | 'expenses' | 'feeding' | 'medicines';
@Component({
  selector: 'app-profitability',
  imports: [
    DetailPage,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    AllocationEditor,
    ProfitAnimalSelect,
  ],
  templateUrl: './profitability.html',
})
export class Profitability implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('finance:read'),
  );
  protected readonly canWrite = computed(
    () => this.allowed() && !!this.session.user()?.permissions.includes('finance:write'),
  );
  protected readonly eye = Eye;
  protected readonly pencil = Pencil;
  protected readonly statusLabel = (status: string) =>
    status === 'not_born' ? 'Nacimiento posterior al corte' : exitLabel(status);
  protected readonly label = (a: Animal) =>
    [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  protected readonly form = this.fb.nonNullable.group({
    animal_id: '',
    status: 'all',
    date_from: '',
    date_to: '',
  });
  protected readonly animalPending = signal(false);
  protected chooseAnimal(a: ProfitAnimal | null) {
    this.form.controls.animal_id.setValue(a?.id || '');
  }
  protected readonly noActivity = computed(() => {
    const p = this.page();
    return (
      !!p &&
      p.total > 0 &&
      (p.activity
        ? p.activity.income_count === 0 && p.activity.expense_count === 0
        : p.total === p.items.length && p.items.every((r) => !r.income_count && !r.expense_count))
    );
  });
  private applied = this.form.getRawValue();
  protected readonly view = signal<'animals' | 'expenses' | 'incomes'>('animals');
  protected readonly page = signal<Page | null>(null);
  protected readonly pending = signal<Pending | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<Row | null>(null);
  protected readonly section = signal<Section>('incomes');
  protected readonly detail = signal<Entries | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly allocating = signal<MoneyRecord | null>(null);
  protected readonly sections: { key: Section; label: string }[] = [
    { key: 'incomes', label: 'Ingresos' },
    { key: 'expenses', label: 'Gastos registrados' },
    { key: 'feeding', label: 'Alimentación de referencia' },
    { key: 'medicines', label: 'Medicamentos de referencia' },
  ];
  private request = 0;
  private detailRequest = 0;
  private destroyed = false;
  ngOnInit() {
    if (this.allowed()) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.detailRequest++;
  }
  private dates() {
    return {
      ...(this.applied.date_from ? { date_from: this.applied.date_from } : {}),
      ...(this.applied.date_to ? { date_to: this.applied.date_to } : {}),
    };
  }
  protected apply() {
    if (this.animalPending()) {
      this.error.set('Selecciona un animal de la lista o limpia la búsqueda para consultar todos.');
      return;
    }
    const v = this.form.getRawValue();
    if (v.date_from && v.date_to && v.date_from > v.date_to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta.');
      return;
    }
    this.applied = v;
    void this.load();
  }
  protected changeView(view: 'animals' | 'expenses' | 'incomes') {
    this.view.set(view);
    void this.load();
  }
  protected async load(offset = 0) {
    if (!this.allowed()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const view = this.view();
    try {
      const params = {
        ...this.dates(),
        ...(this.applied.animal_id ? { animal_id: this.applied.animal_id } : {}),
        status: this.applied.status,
        offset: view === 'animals' ? offset : 0,
        limit: 25,
      };
      const [p, pending] = await Promise.all([
        firstValueFrom(
          this.http.get<Page>(`${this.api}/finance/profitability`, { params }).pipe(timeout(15000)),
        ),
        view === 'animals'
          ? Promise.resolve(null)
          : firstValueFrom(
              this.http
                .get<Pending>(`${this.api}/finance/profitability/pending`, {
                  params: { ...this.dates(), kind: view, offset, limit: 25 },
                })
                .pipe(timeout(15000)),
            ),
      ]);
      if (n === this.request && !this.destroyed) {
        this.page.set(p);
        this.pending.set(pending);
      }
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudo consultar el resultado por animal.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  protected open(row: Row) {
    this.selected.set(row);
    this.section.set('incomes');
    this.detail.set(null);
    void this.loadDetail();
  }
  protected close() {
    this.detailRequest++;
    this.selected.set(null);
    this.detail.set(null);
  }
  protected changeSection(section: Section) {
    this.section.set(section);
    void this.loadDetail();
  }
  protected async loadDetail(offset = 0) {
    const row = this.selected();
    if (!row) return;
    const n = ++this.detailRequest;
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<Entries>(`${this.api}/finance/profitability/${row.animal.id}/entries`, {
            params: { ...this.dates(), section: this.section(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.detailRequest && !this.destroyed) this.detail.set(p);
    } catch (e) {
      if (n === this.detailRequest && !this.destroyed)
        this.detailError.set(apiError(e, 'No se pudieron consultar los registros de origen.'));
    } finally {
      if (n === this.detailRequest && !this.destroyed) this.detailLoading.set(false);
    }
  }
  protected saved() {
    this.allocating.set(null);
    void this.load();
  }
  protected via(value: string) {
    return (
      (
        {
          sale: 'Venta vinculada',
          direct: 'Directo',
          case: 'Caso sanitario',
          group: 'Reparto de lote',
          application: 'Aplicación real',
        } as Record<string, string>
      )[value] || value
    );
  }
}
