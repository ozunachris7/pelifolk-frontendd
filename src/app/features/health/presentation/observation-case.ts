import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Session } from '../../../core/auth/session';
import { Modal } from '../../../shared/ui/modal/modal';
import { HealthCase, Observation, animalLabel, statusLabel } from '../domain/health';

@Component({
  selector: 'app-observation-case',
  imports: [DatePipe, ReactiveFormsModule, Modal],
  template: `
    <app-modal title="Atender observación" [busy]="busy()" (dismiss)="close()">
      <p class="text-lg font-medium">{{ label(observation().animal) }}</p>
      <div class="my-5 border-l-2 border-stone-300 pl-3 dark:border-white/20">
        <p class="text-xs text-stone-500">
          {{ observation().date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ observation().recorded_by }}
        </p>
        <p class="mt-2 whitespace-pre-wrap break-words text-sm">{{ observation().observation }}</p>
      </div>
      <p class="mb-5 text-xs leading-5 text-stone-500">
        El hallazgo original se conserva. Vincúlalo al caso que originó; el inicio del caso debe ser
        igual o posterior a esta observación.
      </p>
      <div class="mb-6 flex flex-wrap gap-4 border-b border-stone-200 text-xs dark:border-white/10">
        <button
          type="button"
          (click)="mode.set('new')"
          [disabled]="busy()"
          [attr.aria-pressed]="mode() === 'new'"
          [class.border-stone-900]="mode() === 'new'"
          [class.dark:border-white]="mode() === 'new'"
          class="border-b-2 border-transparent pb-3"
        >
          Abrir caso nuevo
        </button>
        <button
          type="button"
          (click)="mode.set('existing')"
          [disabled]="busy()"
          [attr.aria-pressed]="mode() === 'existing'"
          [class.border-stone-900]="mode() === 'existing'"
          [class.dark:border-white]="mode() === 'existing'"
          class="border-b-2 border-transparent pb-3"
        >
          Vincular a caso existente
        </button>
      </div>
      <form [formGroup]="form" (ngSubmit)="save()">
        <fieldset [disabled]="busy()" class="min-w-0 space-y-5">
          @if (mode() === 'new') {
            <div>
              <label for="source-case-date" class="mb-2 block text-xs">Fecha de inicio *</label
              ><input
                id="source-case-date"
                type="date"
                formControlName="start_date"
                [min]="observation().date"
                [max]="today"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
            </div>
            <div>
              <label for="source-case-reason" class="mb-2 block text-xs">Motivo del caso *</label
              ><textarea
                id="source-case-reason"
                formControlName="reason"
                maxlength="255"
                rows="3"
                class="w-full rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              ></textarea>
            </div>
            <div>
              <label for="source-case-notes" class="mb-2 block text-xs">Notas iniciales</label
              ><textarea
                id="source-case-notes"
                formControlName="notes"
                maxlength="5000"
                rows="3"
                class="w-full rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              ></textarea>
            </div>
          } @else {
            <div>
              <label for="source-case-search" class="mb-2 block text-xs">Buscar por motivo</label>
              <div class="flex min-w-0 gap-2">
                <input
                  id="source-case-search"
                  [formControl]="search"
                  maxlength="100"
                  class="min-w-0 flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                /><button
                  type="button"
                  (click)="loadOptions()"
                  [disabled]="loading()"
                  class="rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
                >
                  Buscar
                </button>
              </div>
            </div>
            @if (loading()) {
              <p role="status" class="text-xs text-stone-500">Cargando casos…</p>
            }
            @if (optionError()) {
              <p role="alert" class="text-xs text-red-700 dark:text-red-300">{{ optionError() }}</p>
            }
            <div>
              <label for="source-case-select" class="mb-2 block text-xs">Caso sanitario *</label
              ><select
                id="source-case-select"
                [formControl]="caseId"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
              >
                <option value="">Selecciona un caso</option>
                @for (c of options(); track c.id) {
                  <option [value]="c.id">
                    {{ c.start_date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ c.reason }} ·
                    {{ statusLabel(c.status) }}
                  </option>
                }
              </select>
            </div>
            <p class="text-xs leading-5 text-stone-500">
              Solo casos de este animal con inicio igual o posterior al hallazgo. Puedes vincular un
              caso cerrado para completar su procedencia sin reabrirlo. Busca por motivo si no
              aparece entre los primeros 100 resultados.
            </p>
          }
          @if (error()) {
            <p role="alert" class="text-xs text-red-700 dark:text-red-300">{{ error() }}</p>
          }
          <div class="flex justify-end gap-3 border-t border-stone-200 pt-5 dark:border-white/10">
            <button
              type="button"
              (click)="close()"
              class="rounded-lg border border-stone-200 px-4 py-3 text-xs dark:border-white/15"
            >
              Cancelar</button
            ><button
              type="submit"
              [disabled]="
                !allowed() || busy() || (mode() === 'existing' && (loading() || !!optionError()))
              "
              class="rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950"
            >
              {{
                busy()
                  ? 'Guardando…'
                  : mode() === 'new'
                    ? 'Abrir y vincular caso'
                    : 'Guardar vínculo'
              }}
            </button>
          </div>
        </fieldset>
      </form>
    </app-modal>
  `,
})
export class ObservationCase implements OnDestroy {
  readonly observation = input.required<Observation>();
  readonly dismiss = output<void>();
  readonly linked = output<string>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private request = 0;
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly allowed = computed(
    () =>
      !!this.session.user()?.permissions.includes('health:read') &&
      !!this.session.user()?.permissions.includes('health:cases:write'),
  );
  protected readonly label = animalLabel;
  protected readonly statusLabel = statusLabel;
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly optionError = signal('');
  protected readonly options = signal<HealthCase[]>([]);
  protected readonly search = this.fb.nonNullable.control('');
  protected readonly caseId = this.fb.nonNullable.control('');
  protected readonly form = this.fb.nonNullable.group({
    start_date: [this.today, Validators.required],
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    notes: ['', Validators.maxLength(5000)],
  });
  constructor() {
    effect(() => {
      this.observation();
      const mode = this.mode();
      this.error.set('');
      if (mode === 'existing') void this.loadOptions();
      else this.request++;
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
  protected close() {
    if (!this.busy()) this.dismiss.emit();
  }
  protected async loadOptions() {
    const id = this.observation().id,
      request = ++this.request;
    this.loading.set(true);
    this.optionError.set('');
    try {
      const options = await firstValueFrom(
        this.http
          .get<HealthCase[]>(`${this.api}/health/observations/${id}/case-options`, {
            params: { q: this.search.value.trim(), limit: 100 },
          })
          .pipe(timeout(15000)),
      );
      if (!this.destroyed && request === this.request) {
        const selected = this.options().find((c) => c.id === this.caseId.value);
        this.options.set(
          selected && !options.some((c) => c.id === selected.id) ? [selected, ...options] : options,
        );
      }
    } catch (e) {
      if (!this.destroyed && request === this.request)
        this.optionError.set(apiError(e, 'No se pudieron cargar los casos.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  protected async save() {
    if (!this.allowed() || this.busy()) return;
    const source = this.observation(),
      v = this.form.getRawValue(),
      mode = this.mode();
    this.error.set('');
    if (mode === 'new') {
      this.form.markAllAsTouched();
      if (this.form.invalid) {
        this.error.set('Completa la fecha y el motivo del caso.');
        return;
      }
      if (v.start_date < source.date || v.start_date > this.today) {
        this.error.set('El inicio debe estar entre la observación y hoy.');
        return;
      }
    } else if (
      this.loading() ||
      this.optionError() ||
      !this.options().some((c) => c.id === this.caseId.value)
    ) {
      this.error.set('Selecciona uno de los casos disponibles.');
      return;
    }
    this.busy.set(true);
    try {
      const result = await firstValueFrom(
        (mode === 'new'
          ? this.http.post<HealthCase>(`${this.api}/health/cases`, {
              animal_id: source.animal.id,
              observation_id: source.id,
              start_date: v.start_date,
              reason: v.reason.trim(),
              notes: v.notes.trim() || null,
            })
          : this.http.post<HealthCase>(`${this.api}/health/observations/${source.id}/case-link`, {
              case_id: this.caseId.value,
            })
        ).pipe(timeout(15000)),
      );
      if (!this.destroyed) this.linked.emit(result.id);
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo vincular la observación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
}
