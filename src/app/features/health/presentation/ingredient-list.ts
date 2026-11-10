import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2 } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { HealthRepository } from '../infrastructure/health-repository';
import { Ingredient, Page } from '../domain/health';
import { HealthNav } from './health-nav';
@Component({
  selector: 'app-ingredient-list',
  imports: [ReactiveFormsModule, LucideAngularModule, Modal, HealthNav],
  templateUrl: './ingredient-list.html',
})
export class IngredientList implements OnInit, OnDestroy {
  private readonly session = inject(Session);
  private readonly repo = inject(HealthRepository);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(
    () => !!this.session.user()?.permissions.includes('health:read'),
  );
  protected readonly canWrite = computed(
    () => this.canRead() && !!this.session.user()?.permissions.includes('health:products:write'),
  );
  protected readonly plus = Plus;
  protected readonly pencil = Pencil;
  protected readonly trash = Trash2;
  protected readonly page = signal<Page<Ingredient>>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Ingredient | null>(null);
  protected readonly removing = signal<Ingredient | null>(null);
  protected readonly formError = signal('');
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
  });
  private request = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async load(offset = 0) {
    if (!this.canRead()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await this.repo.ingredients(this.query().trim(), offset);
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudo consultar el catálogo.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  protected open(item: Ingredient | null = null) {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(item);
    this.form.reset({ name: item?.name ?? '' });
    this.formError.set('');
    this.formOpen.set(true);
  }
  protected close() {
    if (this.busy()) return;
    this.formOpen.set(false);
    this.removing.set(null);
  }
  protected confirmDelete(item: Ingredient) {
    if (!this.canWrite() || this.busy() || item.product_count) return;
    this.removing.set(item);
    this.formError.set('');
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.saveIngredient(this.form.controls.name.value.trim(), this.editing()?.id);
      if (this.destroyed) return;
      this.formOpen.set(false);
      this.success.set(
        this.editing() ? 'Principio activo actualizado.' : 'Principio activo registrado.',
      );
      await this.load();
    } catch (e) {
      if (!this.destroyed)
        this.formError.set(apiError(e, 'No se pudo guardar el principio activo.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected async remove() {
    const item = this.removing();
    if (!item || !this.canWrite() || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.repo.deleteIngredient(item.id);
      if (this.destroyed) return;
      this.removing.set(null);
      this.success.set('Principio activo eliminado.');
      await this.load();
    } catch (e) {
      if (!this.destroyed)
        this.formError.set(
          apiError(e, 'No se pudo eliminar. Comprueba si está asignado a un producto.'),
        );
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
