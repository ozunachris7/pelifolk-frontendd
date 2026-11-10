import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Plus, ArrowRightLeft, UserMinus, ArrowLeft } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { ManageOrganization } from '../application/manage-organization';
import { AnimalOption, Group, Membership, optionLabel, todayDate } from '../domain/organization';
import { OrganizationNav } from './organization-nav';
@Component({
  selector: 'app-group-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, LucideAngularModule, Modal, OrganizationNav],
  templateUrl: './group-detail.html',
})
export class GroupDetail implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly management = inject(ManageOrganization);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'groups:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'groups:write'),
  );
  protected readonly group = signal<Group | null>(null);
  protected readonly memberships = signal<Membership[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly current = signal(true);
  protected readonly pageSize = 25;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly busy = signal(false);
  protected readonly dialog = signal<'assign' | 'move' | 'remove' | null>(null);
  protected readonly member = signal<Membership | null>(null);
  protected readonly formError = signal('');
  protected readonly lookupLoading = signal(false);
  protected readonly lookupError = signal('');
  protected readonly options = signal<AnimalOption[]>([]);
  protected readonly optionTotal = signal(0);
  protected readonly selected = signal<AnimalOption[]>([]);
  protected readonly targets = signal<Group[]>([]);
  protected readonly animalSearch = this.fb.nonNullable.control('', Validators.maxLength(100));
  protected readonly movement = this.fb.nonNullable.group({
    effective_date: [todayDate(), Validators.required],
    target_group_id: [''],
    move_existing: [false],
  });
  protected readonly today = todayDate();
  protected readonly optionLabel = optionLabel;
  protected readonly plusIcon = Plus;
  protected readonly moveIcon = ArrowRightLeft;
  protected readonly removeIcon = UserMinus;
  protected readonly backIcon = ArrowLeft;
  private id = '';
  private request = 0;
  private lookupRequest = 0;
  private destroyed = false;
  private routeSubscription?: Subscription;
  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.page.set(0);
      this.current.set(true);
      this.closeDialog();
      void this.load();
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.lookupRequest++;
    this.routeSubscription?.unsubscribe();
  }
  protected async load() {
    if (!this.canRead() || !this.id || this.destroyed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const [group, page] = await Promise.all([
        this.management.group(this.session.user(), this.id),
        this.management.memberships(
          this.session.user(),
          this.id,
          this.current(),
          this.page() * this.pageSize,
          this.pageSize,
        ),
      ]);
      if (request !== this.request) return;
      if (!page.items.length && page.total && this.page()) {
        this.page.set(Math.ceil(page.total / this.pageSize) - 1);
        void this.load();
        return;
      }
      this.group.set(group);
      this.memberships.set(page.items);
      this.total.set(page.total);
    } catch (error) {
      if (request === this.request) this.error.set(apiError(error, 'No se pudo cargar el lote.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected setView(current: boolean) {
    if (this.loading()) return;
    this.current.set(current);
    this.page.set(0);
    void this.load();
  }
  protected changePage(delta: number) {
    this.page.update((page) => Math.max(0, page + delta));
    void this.load();
  }
  private prepareDialog(mode: 'assign' | 'move' | 'remove', member: Membership | null = null) {
    this.dialog.set(mode);
    this.member.set(member);
    this.formError.set('');
    this.lookupError.set('');
    this.lookupLoading.set(false);
    this.lookupRequest++;
    this.selected.set([]);
    this.options.set([]);
    this.targets.set([]);
    this.animalSearch.reset();
    this.movement.reset({ effective_date: this.today, target_group_id: '', move_existing: false });
    this.movement.controls.target_group_id.setValidators(
      mode === 'move' ? Validators.required : [],
    );
    this.movement.controls.target_group_id.updateValueAndValidity();
  }
  protected openAssign() {
    if (!this.canWrite() || !this.group()?.active || this.busy()) return;
    this.prepareDialog('assign');
    void this.searchAnimals();
  }
  protected async openMove(member: Membership) {
    if (!this.canWrite() || this.busy()) return;
    this.prepareDialog('move', member);
    this.lookupLoading.set(true);
    const request = ++this.lookupRequest;
    try {
      const groups = await this.management.groups(this.session.user());
      if (request === this.lookupRequest)
        this.targets.set(groups.filter((group) => group.active && group.id !== this.id));
    } catch (error) {
      if (request === this.lookupRequest)
        this.lookupError.set(apiError(error, 'No se pudieron cargar los lotes de destino.'));
    } finally {
      if (request === this.lookupRequest) this.lookupLoading.set(false);
    }
  }
  protected openRemove(member: Membership) {
    if (this.canWrite() && !this.busy()) this.prepareDialog('remove', member);
  }
  protected closeDialog() {
    if (this.busy()) return;
    this.lookupRequest++;
    this.dialog.set(null);
  }
  protected async searchAnimals() {
    if (this.animalSearch.invalid || this.busy()) return;
    const request = ++this.lookupRequest;
    this.lookupLoading.set(true);
    this.lookupError.set('');
    try {
      const result = await this.management.animalOptions(
        this.session.user(),
        this.animalSearch.value,
      );
      if (request === this.lookupRequest) {
        this.options.set(result.items);
        this.optionTotal.set(result.total);
      }
    } catch (error) {
      if (request === this.lookupRequest)
        this.lookupError.set(apiError(error, 'No se pudieron buscar los animales.'));
    } finally {
      if (request === this.lookupRequest) this.lookupLoading.set(false);
    }
  }
  protected isSelected(id: string) {
    return this.selected().some((animal) => animal.id === id);
  }
  protected toggle(animal: AnimalOption) {
    if (this.busy() || animal.group_id === this.id) return;
    if (this.isSelected(animal.id))
      this.selected.update((selected) => selected.filter((item) => item.id !== animal.id));
    else if (this.selected().length < 100)
      this.selected.update((selected) => [...selected, animal]);
    else this.formError.set('Puedes asignar hasta 100 animales a la vez.');
  }
  protected async saveMovement() {
    this.movement.markAllAsTouched();
    if (this.movement.invalid || this.busy() || this.lookupLoading() || this.lookupError()) return;
    const mode = this.dialog();
    if (!mode) return;
    this.formError.set('');
    const values = this.movement.getRawValue();
    if (values.effective_date > this.today) {
      this.formError.set('La fecha de movimiento no puede ser futura.');
      return;
    }
    if (mode === 'assign' && !this.selected().length) {
      this.formError.set('Selecciona al menos un animal.');
      return;
    }
    this.busy.set(true);
    try {
      if (mode === 'assign')
        await this.management.assign(this.session.user(), this.id, {
          animal_ids: this.selected().map((animal) => animal.id),
          effective_date: values.effective_date,
          move_existing: values.move_existing,
        });
      else if (mode === 'move')
        await this.management.assign(this.session.user(), values.target_group_id, {
          animal_ids: [this.member()!.animal_id],
          effective_date: values.effective_date,
          move_existing: true,
        });
      else
        await this.management.remove(
          this.session.user(),
          this.id,
          this.member()!.animal_id,
          values.effective_date,
        );
      if (this.destroyed) return;
      this.dialog.set(null);
      this.success.set(
        mode === 'assign'
          ? 'Animales asignados al lote.'
          : mode === 'move'
            ? 'Animal trasladado. El historial se conserva.'
            : 'Animal retirado del lote. El historial se conserva.',
      );
      this.page.set(0);
      void this.load();
    } catch (error) {
      if (!this.destroyed)
        this.formError.set(apiError(error, 'No se pudo registrar el movimiento.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
