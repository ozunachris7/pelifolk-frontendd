import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { hasPermission } from '../../users/domain/access';
import { HealthNav } from './health-nav';
import { Followup, HealthCase, Page, animalLabel, evolutionLabel } from '../domain/health';
interface Review {
  case: HealthCase;
  followup: Followup;
  next_review_date: string;
  status: 'overdue' | 'due' | 'upcoming';
}
@Component({
  selector: 'app-review-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, HealthNav],
  template: `
    <app-health-nav />
    <header class="mb-6">
      <h1 class="text-2xl font-semibold">Revisiones clínicas</h1>
      <p class="mt-2 text-sm text-stone-500">
        Próximas revisiones de casos sin cerrar, según su seguimiento más reciente. Los animales que
        salieron del hato conservan el historial y dejan de aparecer aquí.
      </p>
    </header>
    @if (!canRead()) {
      <p>No tienes permiso para consultar sanidad.</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="load()" class="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Buscar animal"
          formControlName="q"
          maxlength="100"
          placeholder="Nombre o SINIIGA"
          class="min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        /><select
          aria-label="Revisiones a mostrar"
          formControlName="state"
          class="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#171717]"
        >
          <option value="attention">Vencidas y para hoy</option>
          <option value="upcoming">Próximas</option>
          <option value="all">Todas las programadas</option></select
        ><button type="submit" class="rounded-lg bg-green-900 px-4 py-2 text-sm text-white">
          Consultar
        </button>
      </form>
      @if (error()) {
        <p role="alert" class="mb-4 text-sm text-red-600">{{ error() }}</p>
      }
      @if (loading()) {
        <p>Cargando revisiones…</p>
      } @else {
        <div
          class="min-w-0 overflow-x-auto rounded-lg border border-stone-200 dark:border-white/10"
        >
          <table class="w-full text-left text-sm">
            <thead class="bg-stone-50 text-xs text-stone-500 dark:bg-[#1c1b19]">
              <tr>
                <th class="p-4">Revisión</th>
                <th class="p-4">Animal y caso</th>
                <th class="p-4">Última evolución</th>
                <th class="p-4">Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              @for (r of page().items; track r.case.id) {
                <tr class="border-t border-stone-200 dark:border-white/10">
                  <td class="whitespace-nowrap p-4">
                    {{ r.next_review_date | date: 'dd/MM/yyyy' : 'UTC'
                    }}<span
                      class="mt-1 block text-xs"
                      [class.text-amber-700]="r.status !== 'upcoming'"
                      >{{ statusLabel(r.status) }}</span
                    >
                  </td>
                  <td class="p-4">
                    <p class="font-medium">{{ label(r.case.animal) }}</p>
                    <p class="mt-1 text-xs text-stone-500">{{ r.case.reason }}</p>
                  </td>
                  <td class="p-4">
                    {{ evolutionLabel(r.followup.evolution)
                    }}<span class="mt-1 block text-xs text-stone-500"
                      >{{ r.followup.date | date: 'dd/MM/yyyy' : 'UTC' }} ·
                      {{ r.followup.recorded_by }}</span
                    >
                  </td>
                  <td class="p-4">
                    <a
                      routerLink="/dashboard/health"
                      [queryParams]="{ case_id: r.case.id }"
                      class="whitespace-nowrap underline underline-offset-4"
                      >Abrir caso</a
                    >
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="p-8 text-center text-stone-500">
                    No hay revisiones programadas con estos filtros.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          <p>{{ page().total }} revisiones</p>
          <div class="flex gap-4">
            <button
              type="button"
              [disabled]="page().offset === 0"
              (click)="load(page().offset - 25)"
              class="disabled:opacity-40"
            >
              Anterior</button
            ><button
              type="button"
              [disabled]="page().offset + 25 >= page().total"
              (click)="load(page().offset + 25)"
              class="disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      }
    }
  `,
})
export class ReviewList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private request = 0;
  private destroyed = false;
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'health:read'));
  protected readonly form = this.fb.nonNullable.group({ q: [''], state: ['attention'] });
  protected readonly page = signal<Page<Review>>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly label = animalLabel;
  protected readonly evolutionLabel = evolutionLabel;
  protected readonly statusLabel = (s: Review['status']) =>
    ({ overdue: 'Vencida', due: 'Para hoy', upcoming: 'Próxima' })[s];
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const page = await firstValueFrom(
        this.http
          .get<Page<Review>>(`${this.api}/health/reviews`, {
            params: { q: v.q.trim(), state: v.state, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (request === this.request) this.page.set(page);
    } catch (e) {
      if (request === this.request)
        this.error.set(apiError(e, 'No se pudieron consultar las revisiones.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
