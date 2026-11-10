import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { hasPermission } from '../../users/domain/access';

interface Weaning {
  date: string;
  weight_kg: string;
  age_days: number | null;
  notes: string | null;
  recorded_by: string;
}

@Component({
  selector: 'app-animal-weaning',
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (canRead()) {
      <section class="mt-7 min-w-0 border-t border-stone-200 pt-5 dark:border-white/10">
        <h3 class="mb-4 text-sm font-medium">Destete</h3>
        @if (loading()) {
          <p role="status" class="text-xs text-stone-500">Cargando destete…</p>
        } @else if (error()) {
          <p role="alert" class="text-xs text-red-700 dark:text-red-300">{{ error() }}</p>
          <button
            type="button"
            (click)="retry.update(increment)"
            class="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
          >
            Reintentar
          </button>
        } @else if (record(); as w) {
          <dl class="grid grid-cols-2 gap-5 text-sm">
            <div>
              <dt class="mb-1 text-xs text-stone-500">Fecha de destete</dt>
              <dd>{{ w.date | date: 'dd/MM/yyyy' : 'UTC' }}</dd>
            </div>
            <div>
              <dt class="mb-1 text-xs text-stone-500">Peso al destete</dt>
              <dd>{{ w.weight_kg | number: '1.2-2' }} kg</dd>
            </div>
            <div class="col-span-2">
              <dt class="mb-1 text-xs text-stone-500">Edad al destete</dt>
              <dd>
                {{
                  w.age_days !== null
                    ? w.age_days + ' días'
                    : 'Desconocida; no había fecha de nacimiento registrada'
                }}
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-xs text-stone-500">
            Edad calculada con la fecha de nacimiento guardada al registrar el destete.
          </p>
          @if (w.notes) {
            <p class="mt-4 whitespace-pre-wrap break-words text-sm">{{ w.notes }}</p>
          }
          <p class="mt-3 text-xs text-stone-500">Registrado por {{ w.recorded_by }}</p>
        } @else {
          <p class="text-xs text-stone-500">Sin destete registrado.</p>
        }
      </section>
    }
  `,
})
export class AnimalWeaning {
  readonly animalId = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'weights:read'));
  protected readonly record = signal<Weaning | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly retry = signal(0);
  protected readonly increment = (value: number) => value + 1;

  constructor() {
    effect((onCleanup) => {
      const id = this.animalId();
      const allowed = this.canRead();
      this.retry();
      this.record.set(null);
      this.error.set('');
      this.loading.set(allowed);
      if (!allowed) return;
      const subscription = this.http
        .get<Weaning | null>(`${this.api}/weanings/animals/${id}`)
        .pipe(timeout(15000))
        .subscribe({
          next: (record) => {
            this.record.set(record);
            this.loading.set(false);
          },
          error: (error) => {
            this.error.set(apiError(error, 'No se pudo cargar el destete.'));
            this.loading.set(false);
          },
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
