import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { KinshipNotice } from './kinship-notice';
import { map, distinctUntilChanged } from 'rxjs';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, History as HistoryIcon, Trash2 } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { BreedingRepository } from '../infrastructure/breeding-repository';
import {
  Animal,
  BirthType,
  BreedingEvent,
  EventPage,
  History,
  Kind,
  Kinship,
  animalLabel,
  kindLabel,
  resultLabel,
} from '../domain/breeding';
@Component({
  selector: 'app-breeding-list',
  imports: [
    DetailPage,
    ReactiveFormsModule,
    DatePipe,
    LucideAngularModule,
    Modal,
    RouterLink,
    KinshipNotice,
  ],
  templateUrl: './breeding-list.html',
})
export class BreedingList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(BreedingRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'breeding:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'breeding:write'),
  );
  protected readonly kind = signal<Kind>('mating');
  protected readonly page = signal<EventPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly busy = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly formKind = signal<Kind>('mating');
  protected readonly females = signal<Animal[]>([]);
  protected readonly males = signal<Animal[]>([]);
  protected readonly types = signal<BirthType[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogReady = signal(false);
  protected readonly optionSearch = signal('');
  protected readonly matings = signal<BreedingEvent[]>([]);
  protected readonly matingLoading = signal(false);
  protected readonly matingError = signal('');
  protected readonly detail = signal<BreedingEvent | null>(null);
  protected readonly historyOpen = signal(false);
  protected readonly history = signal<History | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly label = animalLabel;
  protected readonly kindLabel = kindLabel;
  protected readonly resultLabel = resultLabel;
  protected readonly plus = Plus;
  protected readonly clock = HistoryIcon;
  protected readonly trash = Trash2;
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly offspring = this.fb.array([this.childForm()]);
  protected readonly form = this.fb.nonNullable.group({
    animal_id: ['', Validators.required],
    male_id: [''],
    date: [this.today, Validators.required],
    notes: ['', Validators.maxLength(5000)],
    result: ['pregnant'],
    mating_event_id: [''],
    birth_type_id: [0],
    offspring: this.offspring,
  });
  protected readonly kinship = signal<Kinship | null>(null);
  protected readonly kinshipLoading = signal(false);
  protected readonly kinshipError = signal('');
  private kinshipRequest = 0;
  private readonly kinshipSubscription = this.form.valueChanges
    .pipe(
      map(() => [this.form.controls.animal_id.value, this.form.controls.male_id.value].join('|')),
      distinctUntilChanged(),
    )
    .subscribe(() => {
      void this.checkKinship();
    });
  protected async checkKinship() {
    const request = ++this.kinshipRequest;
    this.kinship.set(null);
    this.kinshipError.set('');
    this.kinshipLoading.set(false);
    const female = this.form.controls.animal_id.value,
      male = this.form.controls.male_id.value;
    if (!this.formOpen() || this.formKind() !== 'mating' || !female || !male || this.destroyed)
      return;
    this.kinshipLoading.set(true);
    try {
      const value = await this.repo.kinship(female, male);
      if (request === this.kinshipRequest) this.kinship.set(value);
    } catch (e) {
      if (request === this.kinshipRequest)
        this.kinshipError.set(apiError(e, 'No se pudo comprobar el parentesco.'));
    } finally {
      if (request === this.kinshipRequest) this.kinshipLoading.set(false);
    }
  }
  private request = 0;
  private optionsRequest = 0;
  private matingRequest = 0;
  private historyRequest = 0;
  private destroyed = false;
  private readonly femaleSubscription = this.form.controls.animal_id.valueChanges.subscribe(() => {
    if (this.formOpen() && this.formKind() === 'pregnancy') void this.loadMatings();
  });
  private childForm() {
    return this.fb.nonNullable.group(
      {
        name: ['', Validators.maxLength(100)],
        siniiga: ['', Validators.maxLength(30)],
        sex: ['', Validators.required],
        alive: [true],
        birth_weight_kg: [
          '',
          [Validators.min(0.01), Validators.max(999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)],
        ],
      },
      {
        validators: (control: AbstractControl) =>
          control.get('name')?.value?.trim() || control.get('siniiga')?.value?.trim()
            ? null
            : { identity: true },
      },
    );
  }
  ngOnInit() {
    const kind = this.route.snapshot.queryParamMap.get('kind');
    if (kind === 'mating' || kind === 'pregnancy' || kind === 'birth') this.kind.set(kind);
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.kinshipRequest++;
    this.kinshipSubscription.unsubscribe();
    this.request++;
    this.optionsRequest++;
    this.matingRequest++;
    this.historyRequest++;
    this.femaleSubscription.unsubscribe();
  }
  protected switchKind(kind: Kind) {
    this.kind.set(kind);
    void this.load();
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.repo.page(this.kind(), this.search().trim(), offset);
      if (request === this.request) this.page.set(page);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudo cargar Reproducción.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected openForm() {
    if (!this.canWrite() || this.busy()) return;
    this.formKind.set(this.kind());
    this.formError.set('');
    this.matings.set([]);
    this.matingError.set('');
    this.optionSearch.set('');
    this.females.set([]);
    this.males.set([]);
    this.types.set([]);
    this.catalogReady.set(false);
    this.formOpen.set(false);
    this.offspring.clear();
    this.offspring.push(this.childForm());
    this.form.controls.male_id.setValidators(this.kind() === 'mating' ? Validators.required : []);
    this.form.controls.birth_type_id.setValidators(
      this.kind() === 'birth' ? Validators.min(1) : [],
    );
    this.form.reset({
      animal_id: '',
      male_id: '',
      date: this.today,
      notes: '',
      result: 'pregnant',
      mating_event_id: '',
      birth_type_id: 0,
    });
    if (this.kind() === 'birth') this.offspring.enable({ emitEvent: false });
    else this.offspring.disable({ emitEvent: false });
    this.formOpen.set(true);
    void this.checkKinship();
    void this.loadOptions();
  }
  protected closeForm() {
    if (!this.busy()) {
      this.optionsRequest++;
      this.matingRequest++;
      this.kinshipRequest++;
      this.formOpen.set(false);
    }
  }
  protected addChild() {
    if (this.offspring.length < 20 && !this.busy()) this.offspring.push(this.childForm());
  }
  protected removeChild(index: number) {
    if (this.offspring.length > 1 && !this.busy()) this.offspring.removeAt(index);
  }
  protected async loadOptions() {
    const request = ++this.optionsRequest;
    this.catalogLoading.set(true);
    this.formError.set('');
    try {
      const [females, males, types] = await Promise.all([
        this.repo.options(this.optionSearch().trim(), 'female'),
        this.repo.options(this.optionSearch().trim(), 'male'),
        this.repo.types(),
      ]);
      if (request === this.optionsRequest) {
        const selectedFemale = this.females().find(
          (a) => a.id === this.form.controls.animal_id.value,
        );
        const selectedMale = this.males().find((a) => a.id === this.form.controls.male_id.value);
        this.females.set(
          selectedFemale && !females.some((a) => a.id === selectedFemale.id)
            ? [selectedFemale, ...females]
            : females,
        );
        this.males.set(
          selectedMale && !males.some((a) => a.id === selectedMale.id)
            ? [selectedMale, ...males]
            : males,
        );
        this.types.set(types);
        this.catalogReady.set(true);
      }
    } catch (error) {
      if (request === this.optionsRequest) {
        this.catalogReady.set(false);
        this.formError.set(apiError(error, 'No se pudieron cargar los animales y tipos de parto.'));
      }
    } finally {
      if (request === this.optionsRequest) this.catalogLoading.set(false);
    }
  }
  protected async loadMatings() {
    const request = ++this.matingRequest;
    this.form.controls.mating_event_id.setValue('');
    this.matings.set([]);
    this.matingError.set('');
    const id = this.form.controls.animal_id.value;
    if (!id) {
      this.matingLoading.set(false);
      return;
    }
    this.matingLoading.set(true);
    try {
      const page = await this.repo.page('mating', '', 0, id);
      if (request === this.matingRequest) this.matings.set(page.items);
    } catch (error) {
      if (request === this.matingRequest)
        this.matingError.set(apiError(error, 'No se pudieron cargar las montas de la hembra.'));
    } finally {
      if (request === this.matingRequest) this.matingLoading.set(false);
    }
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || !this.canWrite() || !this.catalogReady()) return;
    const v = this.form.getRawValue(),
      kind = this.formKind();
    if (v.date > this.today) {
      this.formError.set('La fecha no puede ser futura.');
      return;
    }
    let data: Record<string, unknown> = {
      animal_id: v.animal_id,
      date: v.date,
      notes: v.notes.trim() || null,
    };
    if (kind === 'mating' && (this.kinshipLoading() || !this.kinship())) {
      this.formError.set('Espera a comprobar el parentesco antes de guardar la monta.');
      return;
    }
    if (kind === 'mating') data = { ...data, male_id: v.male_id };
    else if (kind === 'pregnancy')
      data = { ...data, result: v.result, mating_event_id: v.mating_event_id || null };
    else
      data = {
        ...data,
        father_id: v.male_id || null,
        birth_type_id: v.birth_type_id,
        offspring: v.offspring.map((o) => ({
          ...o,
          name: o.name.trim() || null,
          siniiga: o.siniiga.trim() || null,
          birth_weight_kg: o.birth_weight_kg ? Number(o.birth_weight_kg) : null,
        })),
      };
    this.busy.set(true);
    this.formError.set('');
    try {
      const saved = await this.repo.create(kind, data);
      if (this.destroyed) return;
      this.kinshipRequest++;
      this.formOpen.set(false);
      this.success.set(
        kind === 'birth'
          ? 'Parto y crías registrados.'
          : kind === 'mating'
            ? 'Monta registrada.'
            : 'Diagnóstico de gestación registrado.',
      );
      this.kind.set(kind);
      await this.load();
      this.detail.set(saved);
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar el registro.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async openHistory(animal: Animal) {
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
        this.historyError.set(apiError(error, 'No se pudo cargar el historial reproductivo.'));
    } finally {
      if (request === this.historyRequest) this.historyLoading.set(false);
    }
  }
  protected closeHistory() {
    this.historyRequest++;
    this.historyOpen.set(false);
  }
  protected historyDetail(event: BreedingEvent) {
    this.detail.set(event);
  }
}
