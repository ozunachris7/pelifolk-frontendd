import { InteractiveChart } from '../../../shared/ui/chart/chart';
import { weightChartModel } from './weight-chart-model';
import { ManagementNav } from './management-nav';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, ChartNoAxesCombined } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { WeightRepository } from '../infrastructure/weight-repository';
import {
  AnimalOption,
  WeightHistory,
  WeightPage,
  animalLabel,
  measurements,
} from '../domain/weights';
@Component({
  selector: 'app-weight-list',
  imports: [
    InteractiveChart,
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    LucideAngularModule,
    Modal,
    ManagementNav,
  ],
  templateUrl: './weight-list.html',
})
export class WeightList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(WeightRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'weights:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'weights:write'),
  );
  protected readonly page = signal<WeightPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly search = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly options = signal<AnimalOption[]>([]);
  protected readonly optionLoading = signal(false);
  protected readonly optionError = signal('');
  protected readonly optionSearch = signal('');
  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly history = signal<WeightHistory | null>(null);
  protected readonly rows = computed(() => measurements(this.history()?.items ?? []));
  protected readonly graph = computed(() => weightChartModel(this.history()?.items ?? []));
  protected readonly label = animalLabel;
  protected readonly plus = Plus;
  protected readonly chartIcon = ChartNoAxesCombined;
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    date: [this.today, Validators.required],
    weight_kg: [
      0,
      [
        Validators.required,
        Validators.min(0.01),
        Validators.max(99999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
    notes: ['', Validators.maxLength(2000)],
  });
  private listRequest = 0;
  private optionRequest = 0;
  private historyRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.optionRequest++;
    this.historyRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const request = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.repo.list(this.search().trim(), offset);
      if (request === this.listRequest) this.page.set(page);
    } catch (error) {
      if (request === this.listRequest)
        this.error.set(apiError(error, 'No se pudieron cargar los pesajes.'));
    } finally {
      if (request === this.listRequest) this.loading.set(false);
    }
  }
  protected openForm() {
    if (!this.canWrite() || this.busy()) return;
    this.form.reset({ animal_id: '', date: this.today, weight_kg: 0, notes: '' });
    this.formError.set('');
    this.optionSearch.set('');
    this.options.set([]);
    this.formOpen.set(true);
    void this.loadOptions();
  }
  protected closeForm() {
    if (!this.busy()) {
      this.formOpen.set(false);
      this.optionRequest++;
    }
  }
  protected async loadOptions() {
    const request = ++this.optionRequest;
    this.optionLoading.set(true);
    this.optionError.set('');
    try {
      const options = await this.repo.options(this.optionSearch().trim());
      if (request === this.optionRequest) this.options.set(options);
    } catch (error) {
      if (request === this.optionRequest)
        this.optionError.set(apiError(error, 'No se pudieron cargar los animales.'));
    } finally {
      if (request === this.optionRequest) this.optionLoading.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || !this.canWrite()) return;
    const data = this.form.getRawValue();
    if (data.date > this.today) {
      this.formError.set('La fecha no puede ser futura.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.create({
        ...data,
        weight_kg: Number(data.weight_kg),
        notes: data.notes.trim() || null,
      });
      if (this.destroyed) return;
      this.formOpen.set(false);
      this.success.set('Pesaje registrado.');
      await this.load();
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo registrar el pesaje.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async openHistory(animal: AnimalOption) {
    const request = ++this.historyRequest;
    this.historyOpen.set(true);
    this.history.set(null);
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const history = await this.repo.history(animal.id);
      if (request === this.historyRequest) this.history.set(history);
    } catch (error) {
      if (request === this.historyRequest)
        this.historyError.set(apiError(error, 'No se pudo cargar el historial.'));
    } finally {
      if (request === this.historyRequest) this.historyLoading.set(false);
    }
  }
  protected closeHistory() {
    this.historyRequest++;
    this.historyOpen.set(false);
  }
}
