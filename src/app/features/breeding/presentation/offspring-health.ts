import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { OffspringCasePage, offspringCaseStatus } from '../domain/offspring-health';
@Component({
  selector: 'app-offspring-health',
  imports: [RouterLink, DatePipe],
  template: ` @if (allowed()) {
    <button
      type="button"
      (click)="opened.set(!opened())"
      [attr.aria-expanded]="opened()"
      data-toggle-offspring-health
      class="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
    >
      {{ opened() ? 'Ocultar casos sanitarios' : 'Ver casos sanitarios' }}
    </button>
    @if (opened()) {
      @if (loading()) {
        <p role="status" class="mt-3 text-xs text-stone-500">Cargando casos…</p>
      } @else if (error()) {
        <p role="alert" class="mt-3 text-xs text-red-700 dark:text-red-300">
          {{ error() }}
          <button type="button" (click)="load(offset())" class="underline">Reintentar</button>
        </p>
      } @else if (page(); as p) {
        <p class="mt-4 text-xs text-stone-500">
          {{ p.total }} casos registrados · Estados al {{ p.as_of | date: 'dd/MM/yyyy' : 'UTC' }}
        </p>
        <ol class="mt-3 space-y-4 border-l border-stone-200 pl-3 dark:border-white/15">
          @for (c of p.items; track c.id) {
            <li data-offspring-case>
              <p class="break-words text-sm">{{ c.reason }}</p>
              <p class="mt-2 text-xs text-stone-500">
                {{ status(c.status) }} · Inicio: {{ c.start_date | date: 'dd/MM/yyyy' : 'UTC' }}
                @if (c.closed_date) {
                  · Cierre: {{ c.closed_date | date: 'dd/MM/yyyy' : 'UTC' }}
                }
              </p>
              <a
                routerLink="/dashboard/health"
                [queryParams]="{ case_id: c.id }"
                class="mt-2 inline-block text-xs underline underline-offset-4"
                >Ver caso</a
              >
            </li>
          } @empty {
            <li class="text-xs text-stone-500">Sin casos sanitarios registrados para esta cría.</li>
          }
        </ol>
        @if (p.total > p.limit) {
          <div class="mt-4 flex flex-wrap justify-end gap-4 text-xs text-stone-500">
            <span>{{ p.offset + 1 }}–{{ p.offset + p.items.length }} de {{ p.total }}</span
            ><button
              type="button"
              (click)="offset.set(p.offset - p.limit)"
              [disabled]="p.offset === 0"
              class="disabled:opacity-40"
            >
              Anterior</button
            ><button
              type="button"
              (click)="offset.set(p.offset + p.limit)"
              [disabled]="p.offset + p.limit >= p.total"
              class="disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        }
      }
    }
  }`,
})
export class OffspringHealth implements OnDestroy {
  readonly parentId = input.required<string>();
  readonly animalId = input.required<string>();
  readonly dateFrom = input<string | null>(null);
  readonly dateTo = input<string | null>(null);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly allowed = computed(() => {
    const p = this.session.user()?.permissions || [];
    return p.includes('breeding:read') && p.includes('health:read');
  });
  protected readonly status = offspringCaseStatus;
  protected readonly opened = signal(false);
  protected readonly offset = signal(0);
  protected readonly page = signal<OffspringCasePage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private destroyed = false;
  private request = 0;
  constructor() {
    effect(() => {
      this.parentId();
      this.animalId();
      this.dateFrom();
      this.dateTo();
      if (this.allowed() && this.opened()) void this.load(this.offset());
      else {
        this.request++;
        this.page.set(null);
        this.error.set('');
        this.loading.set(false);
      }
    });
  }
  async load(offset = 0) {
    if (!this.allowed()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.page.set(null);
    this.error.set('');
    try {
      const p = await firstValueFrom(
        this.http
          .get<OffspringCasePage>(
            `${this.api}/breeding/performance/${this.parentId()}/offspring/${this.animalId()}/health-cases`,
            {
              params: {
                offset,
                limit: 10,
                ...(this.dateFrom() ? { date_from: this.dateFrom()! } : {}),
                ...(this.dateTo() ? { date_to: this.dateTo()! } : {}),
              },
            },
          )
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudieron consultar los casos de la cría.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
}
