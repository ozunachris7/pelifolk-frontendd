import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { ReactionSummary } from './reaction-summary';
import { TreatmentDoses } from './treatment-doses';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Bell, History } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { HealthRepository } from '../infrastructure/health-repository';
import {
  HealthProgram,
  Page,
  Product,
  ProgramNotice,
  ProgramSchedule,
  Treatment,
  TreatmentCatalogs,
  animalLabel,
  catalogLabel,
  lastTreatmentDay,
  noticeLabel,
} from '../domain/health';
import { HealthNav } from './health-nav';
@Component({
  selector: 'app-program-list',
  imports: [
    DetailPage,
    ReactionSummary,
    ReactiveFormsModule,
    DatePipe,
    LucideAngularModule,
    Modal,
    HealthNav,
    TreatmentDoses,
  ],
  templateUrl: './program-list.html',
})
export class ProgramList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(HealthRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'health:read'));
  protected readonly canApply = computed(
    () =>
      this.canRead() && hasPermission(this.session.user(), 'health:program_applications:create'),
  );
  protected readonly canDose = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'health:doses:create'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'health:programs:write'),
  );
  protected readonly page = signal<Page<HealthProgram>>({
    items: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  protected readonly search = signal('');
  protected readonly status = signal('active');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly editing = signal<HealthProgram | null>(null);
  protected readonly products = signal<Product[]>([]);
  protected readonly productSearch = signal('');
  protected readonly productLoading = signal(false);
  protected readonly productError = signal('');
  protected readonly scheduleOpen = signal(false);
  protected readonly schedule = signal<ProgramSchedule | null>(null);
  protected readonly scheduleLoading = signal(false);
  protected readonly scheduleError = signal('');
  protected readonly scheduleSearch = signal('');
  protected readonly noticeState = signal('attention');
  protected readonly selectedProgram = signal<HealthProgram | null>(null);
  protected readonly applicationOpen = signal(false);
  protected readonly applicationError = signal('');
  protected readonly selectedAnimal = signal<ProgramNotice | null>(null);
  protected readonly catalogs = signal<TreatmentCatalogs | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly applications = signal<Treatment[]>([]);
  protected readonly label = animalLabel;
  protected readonly catalogLabel = catalogLabel;
  protected readonly noticeLabel = noticeLabel;
  protected readonly lastTreatmentDay = lastTreatmentDay;
  protected readonly plus = Plus;
  protected readonly pencil = Pencil;
  protected readonly bell = Bell;
  protected readonly clock = History;
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    product_id: ['', Validators.required],
    interval_days: [
      90,
      [Validators.required, Validators.min(1), Validators.max(36500), Validators.pattern(/^\d+$/)],
    ],
    minimum_age_days: [
      0,
      [Validators.required, Validators.min(0), Validators.max(36500), Validators.pattern(/^\d+$/)],
    ],
    sex: [''],
    notice_days: [
      7,
      [Validators.required, Validators.min(0), Validators.max(36500), Validators.pattern(/^\d+$/)],
    ],
    active: [true],
  });
  protected readonly applicationForm = this.fb.nonNullable.group({
    start_date: [this.today, Validators.required],
    dose_value: [
      0,
      [
        Validators.required,
        Validators.min(0.001),
        Validators.max(9999999.999),
        Validators.pattern(/^\d+(\.\d{1,3})?$/),
      ],
    ],
    dose_unit_id: [0, Validators.min(1)],
    route_id: [0, Validators.min(1)],
    frequency_hours: [
      '',
      [Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(2147483647)],
    ],
    duration_days: [
      1,
      [Validators.required, Validators.min(1), Validators.max(3650), Validators.pattern(/^\d+$/)],
    ],
  });
  private request = 0;
  private productRequest = 0;
  private scheduleRequest = 0;
  private applicationRequest = 0;
  private historyRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.productRequest++;
    this.scheduleRequest++;
    this.applicationRequest++;
    this.historyRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.repo.programs(
        this.search().trim(),
        this.status() === 'all' ? null : this.status() === 'active',
        offset,
      );
      if (request === this.request) this.page.set(page);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudieron cargar los programas.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected openForm(p: HealthProgram | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(p);
    this.formError.set('');
    this.productSearch.set('');
    this.products.set([]);
    this.form.reset({
      name: p?.name ?? '',
      product_id: p?.product.id ?? '',
      interval_days: p?.interval_days ?? 90,
      minimum_age_days: p?.minimum_age_days ?? 0,
      sex: p?.sex ?? '',
      notice_days: p?.notice_days ?? 7,
      active: p?.active ?? true,
    });
    this.formOpen.set(true);
    void this.loadProducts();
  }
  protected closeForm() {
    if (!this.busy()) {
      this.productRequest++;
      this.formOpen.set(false);
    }
  }
  protected async loadProducts() {
    const request = ++this.productRequest;
    this.productLoading.set(true);
    this.productError.set('');
    try {
      const page = await this.repo.products(this.productSearch().trim(), true, 0, 100);
      if (request === this.productRequest) {
        const current = this.editing()?.product;
        this.products.set(
          current && !page.items.some((p) => p.id === current.id)
            ? [current, ...page.items]
            : page.items,
        );
      }
    } catch (error) {
      if (request === this.productRequest)
        this.productError.set(apiError(error, 'No se pudieron cargar los productos.'));
    } finally {
      if (request === this.productRequest) this.productLoading.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    const values = this.form.getRawValue();
    try {
      await this.repo.saveProgram(
        {
          ...values,
          name: values.name.trim(),
          sex: values.sex ? (values.sex as 'male' | 'female') : null,
        },
        this.editing()?.id,
      );
      if (this.destroyed) return;
      this.formOpen.set(false);
      this.success.set(this.editing() ? 'Programa actualizado.' : 'Programa registrado.');
      await this.load();
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar el programa.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected openSchedule(p: HealthProgram) {
    this.selectedProgram.set(p);
    this.scheduleSearch.set('');
    this.noticeState.set('attention');
    this.scheduleOpen.set(true);
    this.schedule.set(null);
    void this.loadSchedule();
  }
  protected closeSchedule() {
    this.scheduleRequest++;
    this.scheduleOpen.set(false);
  }
  protected async loadSchedule(offset = 0) {
    const p = this.selectedProgram();
    if (!p || !this.canRead()) return;
    const request = ++this.scheduleRequest;
    this.scheduleLoading.set(true);
    this.scheduleError.set('');
    try {
      const schedule = await this.repo.schedule(
        p.id,
        this.scheduleSearch().trim(),
        this.noticeState(),
        offset,
      );
      if (request === this.scheduleRequest) {
        this.schedule.set(schedule);
        this.selectedProgram.set(schedule.program);
      }
    } catch (error) {
      if (request === this.scheduleRequest)
        this.scheduleError.set(apiError(error, 'No se pudieron cargar los avisos.'));
    } finally {
      if (request === this.scheduleRequest) this.scheduleLoading.set(false);
    }
  }
  protected async openApplication(notice: ProgramNotice) {
    if (!notice.can_apply || !this.canApply() || this.busy()) return;
    this.selectedAnimal.set(notice);
    this.applicationOpen.set(true);
    this.applicationError.set('');
    this.catalogs.set(null);
    this.applicationForm.reset({
      start_date: this.today,
      dose_value: 0,
      dose_unit_id: 0,
      route_id: 0,
      frequency_hours: '',
      duration_days: 1,
    });
    const request = ++this.applicationRequest;
    this.catalogLoading.set(true);
    try {
      const catalogs = await this.repo.catalogs();
      if (request === this.applicationRequest) this.catalogs.set(catalogs);
    } catch (error) {
      if (request === this.applicationRequest)
        this.applicationError.set(
          apiError(
            error,
            'No se pudieron cargar unidades y vías. Cierra y vuelve a abrir el formulario.',
          ),
        );
    } finally {
      if (request === this.applicationRequest) this.catalogLoading.set(false);
    }
  }
  protected returnSchedule() {
    this.scheduleOpen.set(true);
    void this.loadSchedule(this.schedule()?.offset ?? 0);
  }
  protected closeApplication() {
    if (!this.busy()) {
      this.applicationRequest++;
      this.applicationOpen.set(false);
      this.returnSchedule();
    }
  }
  protected async apply() {
    this.applicationForm.markAllAsTouched();
    const p = this.selectedProgram(),
      a = this.selectedAnimal();
    if (
      !p ||
      !a ||
      !this.canApply() ||
      this.applicationForm.invalid ||
      !this.catalogs() ||
      this.busy()
    )
      return;
    const values = this.applicationForm.getRawValue();
    if (values.start_date > this.today) {
      this.applicationError.set('La fecha no puede ser futura.');
      return;
    }
    this.busy.set(true);
    this.applicationError.set('');
    try {
      await this.repo.applyProgram(p.id, {
        ...values,
        animal_id: a.animal.id,
        frequency_hours: values.frequency_hours ? Number(values.frequency_hours) : null,
      });
      if (this.destroyed) return;
      this.applicationOpen.set(false);
      this.success.set('Aplicación registrada. Los avisos se actualizaron con la nueva fecha.');
      this.returnSchedule();
    } catch (error) {
      if (!this.destroyed)
        this.applicationError.set(apiError(error, 'No se pudo registrar la aplicación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async openHistory(notice: ProgramNotice) {
    const p = this.selectedProgram();
    if (!p) return;
    this.closeSchedule();
    this.selectedAnimal.set(notice);
    this.historyOpen.set(true);
    this.applications.set([]);
    this.historyError.set('');
    const request = ++this.historyRequest;
    this.historyLoading.set(true);
    try {
      const history = await this.repo.history(notice.animal.id);
      if (request === this.historyRequest)
        this.applications.set(history.treatments.filter((t) => t.program_id === p.id));
    } catch (error) {
      if (request === this.historyRequest)
        this.historyError.set(apiError(error, 'No se pudo cargar el historial de aplicaciones.'));
    } finally {
      if (request === this.historyRequest) this.historyLoading.set(false);
    }
  }
  protected closeHistory() {
    if (this.busy()) return;
    this.historyRequest++;
    this.historyOpen.set(false);
    this.returnSchedule();
  }
}
