import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Pencil, Trash2 } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { ManageAnimals } from '../application/manage-animals';
import { Breed } from '../domain/animal';

@Component({
  selector: 'app-breed-list',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, Modal],
  templateUrl: './breed-list.html',
})
export class BreedList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly management = inject(ManageAnimals);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'animals:read'));
  protected readonly canWrite = computed(
    () => this.canRead() && hasPermission(this.session.user(), 'animals:write'),
  );
  protected readonly breeds = signal<Breed[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Breed | null>(null);
  protected readonly deleting = signal<Breed | null>(null);
  protected readonly search = signal('');
  protected readonly filtered = computed(() =>
    this.breeds().filter((breed) =>
      breed.name.toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase()),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
  });
  protected readonly plusIcon = Plus;
  protected readonly editIcon = Pencil;
  protected readonly deleteIcon = Trash2;
  private request = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async load() {
    if (!this.canRead() || this.destroyed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const breeds = await this.management.breeds(this.session.user());
      if (request === this.request) this.breeds.set(breeds);
    } catch (error) {
      if (request === this.request)
        this.error.set(apiError(error, 'No se pudo cargar el catálogo de razas.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected openForm(breed: Breed | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(breed);
    this.form.reset({ name: breed?.name ?? '' });
    this.formError.set('');
    this.formOpen.set(true);
  }
  protected closeForm() {
    if (!this.busy()) this.formOpen.set(false);
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    const editing = this.editing();
    try {
      const name = this.form.controls.name.value.trim();
      const saved = editing
        ? await this.management.updateBreed(this.session.user(), editing.id, name)
        : await this.management.createBreed(this.session.user(), name);
      if (this.destroyed) return;
      this.breeds.update((breeds) =>
        [...breeds.filter((breed) => breed.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.formOpen.set(false);
      this.success.set(editing ? 'Nombre de la raza actualizado.' : 'Raza registrada.');
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo guardar la raza.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected askDelete(breed: Breed) {
    if (!this.canWrite() || this.busy()) return;
    this.deleting.set(breed);
    this.formError.set('');
  }
  protected cancelDelete() {
    if (!this.busy()) this.deleting.set(null);
  }
  protected async confirmDelete() {
    const breed = this.deleting();
    if (!breed || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.management.deleteBreed(this.session.user(), breed.id);
      if (this.destroyed) return;
      this.breeds.update((breeds) => breeds.filter((item) => item.id !== breed.id));
      this.deleting.set(null);
      this.success.set('Raza eliminada.');
    } catch (error) {
      if (!this.destroyed) this.formError.set(apiError(error, 'No se pudo eliminar la raza.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
