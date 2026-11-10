import { AnimalWeightChart } from './animal-weight-chart';
import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { AssessmentSummary } from '../../breeding/presentation/assessment-summary';
import { PhysicalSummary } from './physical-summary';
import { IncidentSummary } from '../../health/presentation/incident-summary';
import { ReactionSummary } from '../../health/presentation/reaction-summary';
import { AnimalTimeline } from './animal-timeline';
import { AnimalWeaning } from './animal-weaning';
import { AnimalDecisions } from './animal-decisions';
import { exitLabel } from '../../exits/domain/exits';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Search, Eye, Network } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { ManageAnimals } from '../application/manage-animals';
import {
  Animal,
  Breed,
  Parent,
  Sex,
  Origin,
  animalLabel,
  breedTotal,
  sexLabel,
  originLabel,
} from '../domain/animal';

@Component({
  selector: 'app-animal-list',
  imports: [
    AnimalWeightChart,
    DetailPage,
    AssessmentSummary,
    PhysicalSummary,
    IncidentSummary,
    ReactionSummary,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    LucideAngularModule,
    Modal,
    AnimalDecisions,
    AnimalWeaning,
    AnimalTimeline,
  ],
  templateUrl: './animal-list.html',
})
export class AnimalList implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(Session);
  private readonly management = inject(ManageAnimals);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'animals:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'animals:write'),
  );
  protected readonly animals = signal<Animal[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = 25;
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Animal | null>(null);
  protected readonly decisionBusy = signal(false);
  protected closeAnimalDetail() {
    if (!this.decisionBusy()) {
      this.detailRequest++;
      this.detail.set(null);
    }
  }
  protected readonly detail = signal<Animal | null>(null);
  protected readonly formError = signal('');
  protected readonly catalogLoading = signal(false);
  protected readonly catalogReady = signal(false);
  protected readonly breeds = signal<Breed[]>([]);
  protected readonly mothers = signal<Parent[]>([]);
  protected readonly fathers = signal<Parent[]>([]);
  protected readonly parentLoading = signal(false);
  protected readonly parentError = signal('');
  protected readonly breedName = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/\S/),
    Validators.maxLength(80),
  ]);
  protected readonly breedError = signal('');
  protected readonly breedBusy = signal(false);
  protected readonly search = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    sex: ['' as Sex | ''],
    active: ['true' as 'true' | 'false' | ''],
  });
  protected readonly parentSearch = this.fb.nonNullable.group({
    mother: [''],
    father: [''],
  });
  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.maxLength(100)],
    siniiga: ['', Validators.maxLength(30)],
    sex: ['female' as Sex, Validators.required],
    birth_date: [''],
    origin: ['born_in_herd' as Origin, Validators.required],
    mother_id: [''],
    father_id: [''],
    is_breeder: [false],
    breeds: this.fb.array<ReturnType<AnimalList['shareControl']>>([]),
  });
  protected readonly today = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();
  protected readonly animalLabel = animalLabel;
  protected readonly sexLabel = sexLabel;
  protected readonly originLabel = originLabel;
  protected readonly statusLabel = exitLabel;
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  protected readonly searchIcon = Search;
  protected readonly viewIcon = Eye;
  protected readonly familyIcon = Network;
  private listRequest = 0;
  private formRequest = 0;
  private detailRequest = 0;
  private parentRequest = 0;
  private destroyed = false;

  ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get('animal_id');
    if (id && this.canRead()) void this.showDetail({ id });
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.formRequest++;
    this.parentRequest++;
    this.detailRequest++;
  }
  protected shareControl(breed_id = 0, percentage = 100) {
    return this.fb.nonNullable.group({
      breed_id: [breed_id, [Validators.required, Validators.min(1)]],
      percentage: [
        percentage,
        [
          Validators.required,
          Validators.min(0.01),
          Validators.max(100),
          Validators.pattern(/^\d+(\.\d{1,2})?$/),
        ],
      ],
    });
  }
  protected addShare() {
    this.form.controls.breeds.push(
      this.shareControl(0, this.form.controls.breeds.length ? 0 : 100),
    );
  }
  protected removeShare(index: number) {
    this.form.controls.breeds.removeAt(index);
  }
  protected percentageTotal() {
    return breedTotal(this.form.controls.breeds.getRawValue());
  }
  protected async load(reset = false) {
    if (!this.canRead() || this.destroyed) return;
    if (reset) this.page.set(0);
    const request = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.management.list(this.session.user(), {
        ...this.search.getRawValue(),
        q: this.search.controls.q.value.trim(),
        offset: this.page() * this.pageSize,
        limit: this.pageSize,
      });
      if (request !== this.listRequest) return;
      if (!result.items.length && result.total && this.page()) {
        this.page.set(Math.ceil(result.total / this.pageSize) - 1);
        void this.load();
        return;
      }
      this.animals.set(result.items);
      this.total.set(result.total);
    } catch (error) {
      if (request === this.listRequest)
        this.error.set(apiError(error, 'No se pudo cargar el hato.'));
    } finally {
      if (request === this.listRequest) this.loading.set(false);
    }
  }
  protected changePage(delta: number) {
    this.page.update((page) => Math.max(0, page + delta));
    void this.load();
  }
  protected async showDetail(animal: Pick<Animal, 'id'>) {
    const request = ++this.detailRequest;
    this.error.set('');
    try {
      const result = await this.management.get(this.session.user(), animal.id);
      if (request === this.detailRequest && !this.destroyed) this.detail.set(result);
    } catch (error) {
      if (request === this.detailRequest)
        this.error.set(apiError(error, 'No se pudo cargar la ficha del animal.'));
    }
  }
  protected async openForm(animal: Animal | null = null) {
    if (!this.canWrite() || this.busy() || this.decisionBusy()) return;
    ++this.detailRequest;
    this.editing.set(animal);
    this.formError.set('');
    this.breedError.set('');
    this.breedName.reset();
    this.parentSearch.reset();
    this.parentError.set('');
    this.form.controls.breeds.clear();
    this.form.reset({
      name: animal?.name ?? '',
      siniiga: animal?.siniiga ?? '',
      sex: animal?.sex ?? 'female',
      birth_date: animal?.birth_date ?? '',
      origin: animal?.origin ?? 'born_in_herd',
      mother_id: animal?.mother_id ?? '',
      father_id: animal?.father_id ?? '',
      is_breeder: animal?.is_breeder ?? false,
    });
    for (const share of animal?.breeds ?? [])
      this.form.controls.breeds.push(this.shareControl(share.breed_id, Number(share.percentage)));
    if (!this.form.controls.breeds.length) this.form.controls.breeds.push(this.shareControl());
    this.mothers.set(animal?.mother ? [animal.mother] : []);
    this.fathers.set(animal?.father ? [animal.father] : []);
    this.formOpen.set(true);
    this.catalogLoading.set(true);
    this.catalogReady.set(false);
    this.breeds.set([]);
    const request = ++this.formRequest;
    void this.loadParents();
    try {
      const breeds = await this.management.breeds(this.session.user());
      if (request === this.formRequest) {
        this.breeds.set(breeds);
        this.catalogReady.set(true);
      }
    } catch (error) {
      if (request === this.formRequest)
        this.formError.set(
          apiError(
            error,
            'No se pudo cargar el catálogo de razas. Cierra y vuelve a abrir el formulario.',
          ),
        );
    } finally {
      if (request === this.formRequest) this.catalogLoading.set(false);
    }
  }
  protected closeForm() {
    if (this.busy() || this.breedBusy()) return;
    this.formRequest++;
    this.parentRequest++;
    this.formOpen.set(false);
  }
  protected async loadParents() {
    const request = ++this.parentRequest;
    const parent_of = this.editing()?.id;
    this.parentLoading.set(true);
    this.parentError.set('');
    try {
      const [mothers, fathers] = await Promise.all([
        this.management.list(this.session.user(), {
          sex: 'female',
          q: this.parentSearch.controls.mother.value.trim(),
          limit: 100,
          parent_of,
        }),
        this.management.list(this.session.user(), {
          sex: 'male',
          q: this.parentSearch.controls.father.value.trim(),
          limit: 100,
          parent_of,
        }),
      ]);
      if (request !== this.parentRequest) return;
      const includeSelected = (
        items: Parent[],
        selected: Parent | null | undefined,
        excluded: string[] = [],
      ) =>
        selected &&
        !excluded.includes(selected.id) &&
        !items.some((item) => item.id === selected.id)
          ? [selected, ...items]
          : items;
      const excluded = new Set([
        ...(mothers.excluded_parent_ids || []),
        ...(fathers.excluded_parent_ids || []),
      ]);
      for (const key of ['mother_id', 'father_id'] as const) {
        if (excluded.has(this.form.controls[key].value)) {
          this.form.controls[key].setValue('');
          this.formError.set(
            'Esa opción corresponde al mismo animal, a un descendiente o a una pareja reproductiva registrada. Selecciona otra.',
          );
        }
      }
      this.mothers.set(
        includeSelected(
          mothers.items,
          this.mothers().find((parent) => parent.id === this.form.controls.mother_id.value),
          mothers.excluded_parent_ids,
        ),
      );
      this.fathers.set(
        includeSelected(
          fathers.items,
          this.fathers().find((parent) => parent.id === this.form.controls.father_id.value),
          fathers.excluded_parent_ids,
        ),
      );
    } catch (error) {
      if (request === this.parentRequest)
        this.parentError.set(
          apiError(error, 'No se pudieron cargar los padres. Reintenta la búsqueda.'),
        );
    } finally {
      if (request === this.parentRequest) this.parentLoading.set(false);
    }
  }
  protected async createBreed() {
    this.breedName.markAsTouched();
    if (this.breedName.invalid || this.breedBusy() || this.busy()) return;
    this.breedBusy.set(true);
    this.breedError.set('');
    try {
      const breed = await this.management.createBreed(this.session.user(), this.breedName.value);
      if (this.destroyed) return;
      this.breeds.update((breeds) =>
        [...breeds, breed].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.breedName.reset();
      const emptyShare = this.form.controls.breeds.controls.find(
        (share) => !share.controls.breed_id.value,
      );
      if (emptyShare) emptyShare.controls.breed_id.setValue(breed.id);
      else
        this.form.controls.breeds.push(
          this.shareControl(breed.id, this.form.controls.breeds.length ? 0 : 100),
        );
    } catch (error) {
      if (!this.destroyed) this.breedError.set(apiError(error, 'No se pudo registrar la raza.'));
    } finally {
      if (!this.destroyed) this.breedBusy.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.busy() ||
      this.breedBusy() ||
      !this.catalogReady() ||
      this.parentLoading() ||
      this.parentError()
    )
      return;
    this.formError.set('');
    const values = this.form.getRawValue();
    if (values.birth_date && values.birth_date > this.today) {
      this.formError.set('La fecha de nacimiento no puede ser futura.');
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.management.save(
        this.session.user(),
        {
          ...values,
          name: values.name.trim() || null,
          siniiga: values.siniiga.trim() || null,
          birth_date: values.birth_date || null,
          mother_id: values.mother_id || null,
          father_id: values.father_id || null,
        },
        this.editing()?.id,
      );
      if (this.destroyed) return;
      if (this.detail()?.id === saved.id) this.detail.set(saved);
      this.success.set(this.editing() ? 'Datos del animal actualizados.' : 'Animal registrado.');
      this.formOpen.set(false);
      void this.load(true);
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar el animal.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
