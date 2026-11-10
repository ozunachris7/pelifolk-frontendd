import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { AssessmentPage, assessmentKind, physicalAnimalLabel } from '../domain/assessment';
@Component({
  selector: 'app-assessment-summary',
  imports: [RouterLink, DatePipe],
  template: ` @if (allowed()) {
    <section class="my-6 min-w-0 border-t border-stone-200 pt-5 dark:border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Evaluaciones maternas y de crías</h3>
        <button
          type="button"
          (click)="opened.set(!opened())"
          [attr.aria-expanded]="opened()"
          data-toggle-assessments
          class="rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
        >
          {{ opened() ? 'Ocultar evaluaciones' : 'Ver evaluaciones' }}
        </button>
      </div>
      @if (opened()) {
        <p class="mt-3 text-xs leading-5 text-stone-500">
          Observaciones descriptivas por fecha y evaluador. No se calcula una puntuación ni un valor
          genético.
        </p>
        @if (loading()) {
          <p role="status" class="mt-3 text-xs text-stone-500">Cargando evaluaciones…</p>
        } @else if (error()) {
          <p role="alert" class="mt-3 text-xs text-red-700 dark:text-red-300">
            {{ error() }}
            <button type="button" (click)="load()" class="underline">Reintentar</button>
          </p>
        } @else if (page(); as p) {
          <ul class="mt-3 divide-y divide-stone-200 dark:divide-white/10">
            @for (r of p.items; track r.id) {
              <li class="py-4" data-assessment-entry>
                <p class="mb-2 text-xs font-medium">{{ kind(r.kind) }} · {{ label(r.animal) }}</p>
                <p class="text-xs font-medium">
                  {{ r.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ r.evaluated_by }}
                </p>
                @for (f of r.findings; track f.code) {
                  @if (f.observation) {
                    <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5">
                      <span class="font-medium">{{ f.label }}:</span> {{ f.observation }}
                    </p>
                  }
                }
                <p class="mt-3 text-xs text-stone-500">Capturada por {{ r.recorded_by }}</p>
              </li>
            } @empty {
              <li class="py-4 text-xs text-stone-500">
                Sin evaluaciones maternas o de crías registradas.
              </li>
            }
          </ul>
          @if (p.total > p.items.length) {
            <p class="mt-2 text-xs text-stone-500">
              Se muestran las {{ p.items.length }} más recientes de {{ p.total }}.
            </p>
          }
        }
        <a
          routerLink="/dashboard/breeding/assessments"
          [queryParams]="{ animal_id: animalId() }"
          class="mt-4 inline-block text-xs underline underline-offset-4"
          >Consultar evaluaciones del animal</a
        >
      }
    </section>
  }`,
})
export class AssessmentSummary implements OnDestroy {
  readonly animalId = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('breeding:read'),
  );
  protected readonly opened = signal(false);
  protected readonly kind = assessmentKind;
  protected readonly label = physicalAnimalLabel;
  protected readonly page = signal<AssessmentPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private destroyed = false;
  private request = 0;
  constructor() {
    effect(() => {
      this.animalId();
      if (this.opened() && this.allowed()) void this.load();
      else {
        this.request++;
        this.page.set(null);
        this.loading.set(false);
        this.error.set('');
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
          .get<AssessmentPage>(`${this.api}/breeding/assessments`, {
            params: { animal_id: this.animalId(), limit: 5, offset: 0 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudieron consultar las evaluaciones.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
}
