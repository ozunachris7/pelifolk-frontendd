import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { hasPermission } from '../../users/domain/access';
import { Modal } from '../../../shared/ui/modal/modal';
import { HealthNav } from './health-nav';
import {
  Withdrawal,
  withdrawalLabel,
  withdrawalReviewReason,
  withdrawalApplicationLabel,
} from '../domain/withdrawal';
@Component({
  selector: 'app-withdrawal-list',
  imports: [DatePipe, ReactiveFormsModule, HealthNav, Modal],
  template: `
    <app-health-nav />
    <header class="mb-6">
      <p class="text-xs uppercase tracking-widest text-stone-500">Sanidad del hato</p>
      <h1 class="mt-2 text-2xl font-semibold">Retiro sanitario</h1>
      <p class="mt-2 max-w-3xl text-sm text-stone-500">
        Consulta el retiro a partir de la última dosis aplicada y los días guardados en cada
        tratamiento. Los registros sin aplicaciones o con variaciones aparecen por verificar.
      </p>
    </header>
    @if (!canRead()) {
      <p>No tienes permiso para consultar sanidad.</p>
    } @else {
      <form [formGroup]="search" (ngSubmit)="load()" class="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Buscar animal"
          formControlName="q"
          placeholder="Nombre o SINIIGA"
          maxlength="100"
          class="min-w-0 rounded-lg border border-stone-200 px-3 py-2 dark:bg-stone-900"
        />
        <button
          type="submit"
          class="rounded-lg bg-green-900 px-4 py-2 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-950"
        >
          Buscar
        </button>
      </form>
      @if (error()) {
        <p role="alert" class="mb-4 text-red-700">{{ error() }}</p>
      }
      @if (loading()) {
        <p aria-live="polite">Consultando retiros…</p>
      } @else {
        <div class="overflow-x-auto rounded-lg border border-stone-200 dark:border-white/10">
          <table class="w-full text-left text-sm">
            <thead class="bg-stone-50 text-xs text-stone-500 dark:bg-stone-900">
              <tr>
                <th class="p-4">Animal</th>
                <th class="p-4">Estado del retiro</th>
                <th class="p-4">Fecha estimada</th>
                <th class="p-4">Tratamientos</th>
                <th class="p-4">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (w of page().items; track w.animal.id) {
                <tr class="border-t border-stone-200 dark:border-white/10">
                  <td class="p-4 font-medium">
                    {{ w.animal.name || 'Sin nombre'
                    }}<span class="block text-xs font-normal text-stone-500">{{
                      w.animal.siniiga || 'Sin SINIIGA'
                    }}</span>
                  </td>
                  <td
                    class="p-4"
                    [class.text-amber-700]="w.status === 'pending' || w.status === 'unknown'"
                  >
                    {{ label(w.status) }}
                    @if (w.in_treatment) {
                      <span class="block text-xs">Pauta aún en curso</span>
                    }
                  </td>
                  <td class="p-4 whitespace-nowrap">
                    {{
                      w.release_date && w.status !== 'unknown' && !w.in_treatment
                        ? (w.release_date | date: 'dd/MM/yyyy' : 'UTC')
                        : '—'
                    }}
                    @if (w.unknown_count) {
                      <span class="block text-xs text-amber-700"
                        >{{ w.unknown_count }} por verificar</span
                      >
                    }
                  </td>
                  <td class="p-4">
                    {{ w.treatment_count }}
                    <span class="mt-1 block text-xs text-stone-500"
                      >Dosis registradas: {{ w.application_count ?? 0 }}</span
                    >
                    @if (w.missing_applications_count) {
                      <span class="mt-1 block text-xs text-amber-700 dark:text-amber-300"
                        >Sin dosis: {{ w.missing_applications_count }}</span
                      >
                    }
                  </td>
                  <td class="p-4">
                    <button
                      type="button"
                      (click)="show(w.animal.id)"
                      class="underline underline-offset-4"
                    >
                      Ver tratamientos
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="p-8 text-stone-500">
                    No hay animales que coincidan con la búsqueda.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>{{ page().total }} animales</p>
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
      <p class="mt-6 text-xs text-stone-500">
        Se muestra la primera fecha completa después del periodo guardado, sin contar el día de
        aplicación. Una pauta en curso no tiene fecha global de liberación; las siguientes dosis
        recalculan la referencia. La bitácora puede estar incompleta. Este cálculo no certifica
        aptitud para consumo: confirma la etiqueta y las indicaciones del veterinario.
      </p>
    }
    @if (open()) {
      <app-modal title="Tratamientos y retiro" (dismiss)="close()">
        @if (detailLoading()) {
          <p>Consultando tratamientos…</p>
        }
        @if (detailError()) {
          <p role="alert" class="text-red-700">{{ detailError() }}</p>
        }
        @if (detail(); as w) {
          <p class="mb-4 font-medium">
            {{ w.animal.name || w.animal.siniiga || 'Animal' }} · {{ label(w.status) }}
          </p>
          @for (t of w.items; track t.event_id + (t.product_id || t.product_name)) {
            <section class="border-t border-stone-200 py-4 dark:border-white/10">
              <h2 class="font-medium">{{ t.product_name }}</h2>
              <p class="mt-2 text-sm">
                Inicio de pauta: {{ t.start_date | date: 'dd/MM/yyyy' : 'UTC' }} · Último día
                previsto:
                {{ t.last_day | date: 'dd/MM/yyyy' : 'UTC' }}
              </p>
              <p class="mt-2 text-sm" data-withdrawal-application>
                Última aplicación:
                {{
                  t.last_applied_at
                    ? applicationLabel(t.last_applied_at)
                    : 'Sin aplicaciones registradas'
                }}
              </p>
              <p class="mt-1 text-xs text-stone-500">
                Dosis registradas: {{ t.application_count ?? 0 }}
              </p>
              <p class="mt-1 text-sm">
                Periodo guardado:
                {{ t.withdrawal_days === null ? 'Por verificar' : t.withdrawal_days + ' días' }}
              </p>
              <p class="mt-1 text-sm">
                {{ label(t.status) }}
                @if (t.release_date) {
                  · Desde {{ t.release_date | date: 'dd/MM/yyyy' : 'UTC' }}
                }
              </p>
              @if (t.estimated_release_date && (!t.release_date || t.status === 'unknown')) {
                <p class="mt-2 text-xs text-stone-500">
                  Referencia desde la última dosis:
                  {{ t.estimated_release_date | date: 'dd/MM/yyyy' : 'UTC' }}.
                  {{
                    t.status === 'unknown'
                      ? 'Sujeta a revisión.'
                      : 'Provisional mientras la pauta siga en curso.'
                  }}
                </p>
              }
              @if (!t.last_applied_at && t.planned_release_date) {
                <p class="mt-2 text-xs text-stone-500">
                  Referencia de pauta: {{ t.planned_release_date | date: 'dd/MM/yyyy' : 'UTC' }}. No
                  confirma aplicaciones realizadas.
                </p>
              }
              @for (reason of t.review_reasons || []; track reason) {
                <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {{ reviewReason(reason) }}
                </p>
              }
            </section>
          } @empty {
            <p>No hay tratamientos registrados.</p>
          }
        }
      </app-modal>
    }
  `,
})
export class WithdrawalList implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'health:read'));
  protected readonly search = this.fb.nonNullable.group({ q: [''] });
  protected readonly label = withdrawalLabel;
  protected readonly reviewReason = withdrawalReviewReason;
  protected readonly applicationLabel = withdrawalApplicationLabel;
  protected readonly page = signal<{
    items: Withdrawal[];
    total: number;
    offset: number;
    limit: number;
  }>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly open = signal(false);
  protected readonly detail = signal<Withdrawal | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  private request = 0;
  private detailRequest = 0;
  private destroyed = false;
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.detailRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const value = await firstValueFrom(
        this.http
          .get<{ items: Withdrawal[]; total: number; offset: number; limit: number }>(
            `${this.api}/health/withdrawals`,
            { params: { q: this.search.getRawValue().q.trim(), offset, limit: 25 } },
          )
          .pipe(timeout(15000)),
      );
      if (request === this.request) this.page.set(value);
    } catch (e) {
      if (request === this.request)
        this.error.set(apiError(e, 'No se pudo consultar el retiro sanitario.'));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  protected async show(id: string) {
    const request = ++this.detailRequest;
    this.open.set(true);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const value = await firstValueFrom(
        this.http
          .get<Withdrawal>(`${this.api}/health/animals/${id}/withdrawal`)
          .pipe(timeout(15000)),
      );
      if (request === this.detailRequest) this.detail.set(value);
    } catch (e) {
      if (request === this.detailRequest)
        this.detailError.set(apiError(e, 'No se pudieron consultar los tratamientos.'));
    } finally {
      if (request === this.detailRequest) this.detailLoading.set(false);
    }
  }
  protected close() {
    this.detailRequest++;
    this.open.set(false);
  }
}
