import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Modal } from '../../../shared/ui/modal/modal';
import { Animal, AnimalPage, Parent, animalLabel, sexLabel, originLabel } from '../domain/animal';
import { Family } from '../domain/genealogy';
import { FamilyNode } from './family-node';
import { exitLabel } from '../../exits/domain/exits';
@Component({
  selector: 'app-genealogy',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, Modal, FamilyNode],
  templateUrl: './genealogy.html',
})
export class Genealogy implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  private optionRequest = 0;
  private animalId = '';
  protected readonly allowed = !!this.session.user()?.permissions.includes('animals:read');
  protected readonly family = signal<Family | null>(null);
  protected readonly detail = signal<Animal | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly optionError = signal('');
  protected readonly optionsLoading = signal(false);
  protected readonly options = signal<Parent[]>([]);
  protected readonly search = this.fb.nonNullable.control('');
  protected readonly selected = this.fb.nonNullable.control('');
  protected readonly label = animalLabel;
  protected readonly sexLabel = sexLabel;
  protected readonly originLabel = originLabel;
  protected readonly status = exitLabel;
  constructor() {
    if (this.allowed) {
      void this.loadOptions();
      this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
        this.animalId = params.get('id') || '';
        this.selected.setValue(this.animalId);
        this.detail.set(null);
        void this.load();
      });
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.optionRequest++;
  }
  protected openSelected() {
    if (this.selected.value)
      void this.router.navigate(['/dashboard/genealogy', this.selected.value]);
  }
  protected async loadOptions() {
    if (!this.allowed) return;
    const request = ++this.optionRequest;
    this.optionsLoading.set(true);
    try {
      const p = await firstValueFrom(
        this.http
          .get<AnimalPage>(`${this.api}/animals`, {
            params: { q: this.search.value.trim(), limit: 100 },
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed || request !== this.optionRequest) return;
      const selected =
        this.options().find((a) => a.id === this.selected.value) || this.family()?.tree.animal;
      if (selected && !p.items.some((a) => a.id === selected.id))
        this.options.set([selected, ...p.items]);
      else this.options.set(p.items);
      this.optionError.set('');
    } catch (e) {
      if (!this.destroyed && request === this.optionRequest)
        this.optionError.set(apiError(e, 'No se pudieron cargar los animales.'));
    } finally {
      if (!this.destroyed && request === this.optionRequest) this.optionsLoading.set(false);
    }
  }
  protected async load(offset = 0) {
    const request = ++this.request;
    this.family.set(null);
    this.error.set('');
    if (!this.allowed || !this.animalId) {
      this.loading.set(false);
      return;
    }
    const id = this.animalId;
    this.loading.set(true);
    try {
      const f = await firstValueFrom(
        this.http
          .get<Family>(`${this.api}/animals/${id}/genealogy`, { params: { offset, limit: 12 } })
          .pipe(timeout(15000)),
      );
      if (this.destroyed || request !== this.request) return;
      this.family.set(f);
      if (!this.options().some((a) => a.id === f.tree.animal.id))
        this.options.update((o) => [f.tree.animal, ...o]);
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(e, 'No se pudo cargar la genealogía del animal.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
}
