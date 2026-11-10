import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { ReactionPage, reactionKind } from '../domain/reaction';
@Component({
  selector: 'app-reaction-summary',
  imports: [RouterLink, DatePipe],
  template: `@if (allowed()) {
    <section
      class="my-6 border-y border-stone-200 py-5 dark:border-white/10"
      aria-label="Antecedentes de alergias y reacciones"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Alergias y reacciones</h3>
        <a
          routerLink="/dashboard/health/reactions"
          [queryParams]="{ animal_id: animalId() }"
          class="text-xs underline underline-offset-4"
          >Ver antecedentes</a
        >
      </div>
      @if (loading()) {
        <p role="status" class="mt-3 text-xs text-stone-500">Consultando antecedentes…</p>
      } @else if (error()) {
        <p role="alert" class="mt-3 text-xs text-red-700 dark:text-red-300">
          {{ error() }} <button type="button" (click)="load()" class="underline">Reintentar</button>
        </p>
      } @else if (page(); as p) {
        <p class="mt-3 text-xs text-stone-500">
          {{ p.total }} {{ p.total === 1 ? 'antecedente registrado' : 'antecedentes registrados' }}.
          Cerrar el seguimiento no descarta una alergia ni elimina el antecedente.
        </p>
        <ul class="mt-3 divide-y divide-stone-200 dark:divide-white/10">
          @for (r of p.items; track r.id) {
            <li class="py-3" data-reaction-summary>
              <p class="text-xs font-medium">
                {{ kind(r.kind) }} · {{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}
              </p>
              <p class="mt-1 text-xs">
                {{ r.product_name || r.suspected_agent || 'Agente sin identificar' }} ·
                {{ r.status === 'open' ? 'Seguimiento abierto' : 'Seguimiento cerrado' }}
              </p>
              <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5">
                {{ r.description }}
              </p>
            </li>
          }
        </ul>
        @if (p.total === 0) {
          <p class="mt-2 text-xs text-stone-500">
            No hay reportes capturados. Esto no confirma ausencia de alergias.
          </p>
        }
        @if (p.total > p.items.length) {
          <p class="mt-2 text-xs text-stone-500">
            Se muestran los {{ p.items.length }} más recientes. Consulta todos en Ver antecedentes.
          </p>
        }
      }
    </section>
  }`,
})
export class ReactionSummary implements OnDestroy {
  readonly animalId = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('health:read'),
  );
  protected readonly page = signal<ReactionPage | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly kind = reactionKind;
  private request = 0;
  private destroyed = false;
  constructor() {
    effect(() => {
      this.animalId();
      if (this.allowed()) void this.load();
      else {
        this.request++;
        this.page.set(null);
        this.error.set('');
        this.loading.set(false);
      }
    });
  }
  async load() {
    if (!this.allowed()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.page.set(null);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<ReactionPage>(`${this.api}/health/reactions`, {
            params: { animal_id: this.animalId(), limit: 5, offset: 0 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudieron consultar los antecedentes.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
}
