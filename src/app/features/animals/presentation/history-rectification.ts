import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  OnDestroy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, FilePenLine } from 'lucide-angular';
import { API_URL } from '../../../core/http/api-url';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
interface Snapshot {
  title: string;
  date: string;
  notes: string | null;
  recorded_by: string | null;
  details: { label: string; value: string }[];
}
interface Rectification {
  id: string;
  version: number;
  mode: string;
  reason: string;
  clarification: string | null;
  original: Snapshot;
  corrected: Record<string, unknown> | null;
  recorded_by: string;
  created_at: string;
}
interface Context {
  source: Snapshot;
  snapshot_token: string;
  version: number;
  can_rectify: boolean;
  replacement_mode: string | null;
  initial: Record<string, any> | null;
  explanation: string | null;
  entries: Rectification[];
}
@Component({
  selector: 'app-history-rectification',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule],
  template: `
    @if (canRectify() || hasRectifications()) {
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="opened()"
        class="mt-3 inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
      >
        <lucide-icon [img]="icon" [size]="14" />{{
          opened()
            ? 'Cerrar rectificaciones'
            : hasRectifications()
              ? 'Ver rectificaciones'
              : 'Rectificar registro'
        }}
      </button>
    }
    @if (opened()) {
      <section
        class="mt-4 min-w-0 space-y-4 border-l-2 border-stone-200 pl-4 dark:border-white/15"
        aria-label="Rectificaciones del registro"
      >
        @if (loading()) {
          <p role="status" class="text-xs text-stone-500">
            Consultando el original y sus rectificaciones…
          </p>
        }
        @if (error()) {
          <p role="alert" class="break-words text-xs text-red-600 dark:text-red-300">
            {{ error() }}
            <button type="button" (click)="refreshRequested.emit()" [disabled]="busy()" class="underline">
              Actualizar historial
            </button>
          </p>
        }
        @if (context(); as c) {
          <h5 class="text-sm font-medium">Rectificación del historial</h5>
          <p class="text-xs leading-5 text-stone-500">
            El original se conserva. Una aclaración añade una nota al historial de este animal: no
            cambia fechas, importes ni cálculos. Una sustitución crea otro registro y los cálculos
            usan el nuevo.
          </p>
          @if (c.explanation) {
            <p class="text-xs leading-5 text-stone-500">{{ c.explanation }}</p>
          }
          @for (r of c.entries; track r.id) {
            <article class="space-y-3 border-b border-stone-200 pb-4 text-xs dark:border-white/15">
              <p class="font-medium">
                {{ r.mode === 'clarification' ? 'Aclaración' : 'Sustitución del registro' }} ·
                {{ r.created_at | date: 'dd/MM/yyyy HH:mm' }}
              </p>
              <p class="text-stone-500">{{ r.recorded_by }}</p>
              <p class="whitespace-pre-wrap break-words"><strong>Motivo:</strong> {{ r.reason }}</p>
              @if (r.clarification) {
                <p class="whitespace-pre-wrap break-words">
                  <strong>Aclaración:</strong> {{ r.clarification }}
                </p>
              }
              <details class="min-w-0">
                <summary class="cursor-pointer text-stone-500">
                  Ver original conservado y datos corregidos
                </summary>
                <div class="mt-3 space-y-2">
                  <p class="font-medium">
                    Original: {{ r.original.title }} ·
                    {{ r.original.date | date: 'dd/MM/yyyy' : 'UTC' }}
                  </p>
                  @for (d of r.original.details; track $index) {
                    <p class="break-words">{{ d.label }}: {{ d.value }}</p>
                  }
                  @if (r.original.notes) {
                    <p class="whitespace-pre-wrap break-words">{{ r.original.notes }}</p>
                  }
                  @if (r.original.recorded_by) {
                    <p class="text-stone-500">Registrado por {{ r.original.recorded_by }}</p>
                  }
                  @if (r.corrected) {
                    <p class="pt-2 font-medium">Datos corregidos</p>
                    @for (d of fields(r.corrected); track d.label) {
                      <p class="whitespace-pre-wrap break-words">{{ d.label }}: {{ d.value }}</p>
                    }
                  }
                </div>
              </details>
            </article>
          } @empty {
            <p class="text-xs text-stone-500">Este registro todavía no tiene rectificaciones.</p>
          }
          @if (c.can_rectify && canRectify()) {
            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
              <fieldset [disabled]="busy()" class="min-w-0 space-y-4">
                <label class="block text-xs"
                  >Tipo de rectificación
                  <select
                    formControlName="mode"
                    class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
                  >
                    <option value="clarification">Agregar aclaración</option>
                    @if (c.replacement_mode) {
                      <option [value]="c.replacement_mode">Sustituir con datos corregidos</option>
                    }
                  </select>
                </label>
                <label class="block text-xs"
                  >Motivo de la rectificación *
                  <textarea
                    formControlName="reason"
                    rows="2"
                    maxlength="2000"
                    placeholder="Explica qué estaba equivocado y cómo se verificó."
                    class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent p-3 text-sm dark:border-white/15"
                  ></textarea>
                  <span class="mt-1 block text-stone-500">Mínimo 10 caracteres.</span>
                </label>
                @if (form.controls.mode.value === 'clarification') {
                  <label class="block text-xs"
                    >Aclaración correcta *
                    <textarea
                      formControlName="clarification"
                      rows="3"
                      maxlength="5000"
                      class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent p-3 text-sm dark:border-white/15"
                    ></textarea>
                    <span class="mt-1 block text-stone-500"
                      >Mínimo 10 caracteres. El registro operativo permanece igual.</span
                    >
                  </label>
                } @else {
                  <label class="block text-xs"
                    >Fecha correcta *
                    <input
                      formControlName="date"
                      type="date"
                      [max]="today"
                      class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                    />
                  </label>
                  @if (c.replacement_mode === 'weight') {
                    <label class="block text-xs"
                      >Peso correcto (kg) *<input
                        formControlName="weight_kg"
                        type="number"
                        min="0.01"
                        max="99999.99"
                        step="0.01"
                        class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                    /></label>
                    <label class="block text-xs"
                      >Notas del pesaje<textarea
                        formControlName="notes"
                        maxlength="2000"
                        rows="2"
                        class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent p-3 text-sm dark:border-white/15"
                      ></textarea>
                    </label>
                  } @else {
                    <label class="block text-xs"
                      >{{
                        c.replacement_mode === 'observation'
                          ? 'Observación correcta'
                          : 'Diagnóstico correcto'
                      }}
                      *<textarea
                        formControlName="text"
                        rows="3"
                        maxlength="5000"
                        class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-transparent p-3 text-sm dark:border-white/15"
                      ></textarea>
                    </label>
                    @if (c.replacement_mode === 'diagnosis') {
                      <label class="block text-xs"
                        >Gravedad<select
                          formControlName="severity"
                          class="mt-2 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
                        >
                          <option value="mild">Leve</option>
                          <option value="moderate">Moderada</option>
                          <option value="severe">Grave</option>
                          <option value="critical">Crítica</option>
                        </select></label
                      >
                    }
                  }
                }
                <button
                  type="submit"
                  class="rounded-lg bg-green-900 px-4 py-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950"
                >
                  {{ busy() ? 'Guardando…' : 'Guardar rectificación' }}
                </button>
              </fieldset>
            </form>
          } @else {
            <p class="text-xs text-stone-500">
              Puedes consultar las rectificaciones. Para registrar otra necesitas el permiso
              especial y la autorización de captura del área.
            </p>
          }
        }
      </section>
    }
  `,
})
export class HistoryRectification implements OnDestroy {
  readonly animalId = input.required<string>();
  readonly entryId = input.required<string>();
  readonly hasRectifications = input(false);
  readonly saved = output<void>();
  readonly refreshRequested = output<void>();
  private http = inject(HttpClient);
  private api = inject(API_URL);
  private session = inject(Session);
  private fb = inject(FormBuilder);
  protected readonly canRectify = computed(
    () => !!this.session.user()?.permissions.includes('history:rectify'),
  );
  protected readonly icon = FilePenLine;
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly opened = signal(false);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly context = signal<Context | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    mode: 'clarification',
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    clarification: '',
    date: '',
    weight_kg: '',
    notes: '',
    text: '',
    severity: 'mild',
  });
  private request = 0;
  private destroyed = false;
  protected toggle() {
    if (this.busy()) return;
    this.opened.update((v) => !v);
    if (this.opened()) void this.load();
  }
  protected async load() {
    if (this.busy()) return;
    const n = ++this.request;
    this.loading.set(true);
    this.context.set(null);
    this.error.set('');
    try {
      const c = await firstValueFrom(
        this.http
          .get<Context>(`${this.api}/animals/${this.animalId()}/rectifications`, {
            params: { entry_id: this.entryId() },
          })
          .pipe(timeout(15000)),
      );
      if (n !== this.request || this.destroyed) return;
      this.context.set(c);
      const i = c.initial || {};
      this.form.reset({
        mode: 'clarification',
        reason: '',
        clarification: '',
        date: i['date'] || '',
        weight_kg: i['weight_kg'] || '',
        notes: i['notes'] || '',
        text: i['observation'] || i['diagnosis'] || '',
        severity: i['severity'] || 'mild',
      });
    } catch (e) {
      if (n === this.request && !this.destroyed)
        this.error.set(apiError(e, 'No se pudieron cargar las rectificaciones.'));
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  protected async save() {
    const c = this.context();
    if (this.busy() || !c?.can_rectify) return;
    const v = this.form.getRawValue();
    this.error.set('');
    if (v.reason.trim().length < 10) {
      this.error.set('Escribe un motivo de al menos 10 caracteres.');
      return;
    }
    if (v.mode === 'clarification' && v.clarification.trim().length < 10) {
      this.error.set('Escribe una aclaración de al menos 10 caracteres.');
      return;
    }
    if (
      v.mode !== 'clarification' &&
      (!v.date ||
        v.date > this.today ||
        (v.mode === 'weight' ? !(Number(v.weight_kg) > 0) : !v.text.trim()))
    ) {
      this.error.set('Completa los datos correctos y revisa la fecha.');
      return;
    }
    const payload: any = {
      entry_id: this.entryId(),
      expected_version: c.version,
      snapshot_token: c.snapshot_token,
      mode: v.mode,
      reason: v.reason.trim(),
    };
    if (v.mode === 'clarification') payload.clarification = v.clarification.trim();
    else {
      payload[v.mode] = { ...c.initial, date: v.date };
      if (v.mode === 'weight') {
        payload.weight.weight_kg = String(v.weight_kg);
        payload.weight.notes = v.notes.trim() || null;
      } else {
        payload[v.mode][v.mode] = v.text.trim();
        if (v.mode === 'diagnosis') payload.diagnosis.severity = v.severity;
      }
    }
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http
          .post(`${this.api}/animals/${this.animalId()}/rectifications`, payload)
          .pipe(timeout(15000)),
      );
      if (!this.destroyed) this.saved.emit();
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo guardar la rectificación.'));
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  protected fields(value: Record<string, unknown>) {
    const labels: Record<string, string> = {
      date: 'Fecha',
      weight_kg: 'Peso (kg)',
      notes: 'Notas',
      observation: 'Observación',
      diagnosis: 'Diagnóstico',
      severity: 'Gravedad',
    };
    const severity: Record<string, string> = {
      mild: 'Leve',
      moderate: 'Moderada',
      severe: 'Grave',
      critical: 'Crítica',
    };
    return Object.entries(value)
      .filter(([k]) => !!labels[k])
      .map(([k, v]) => ({
        label: labels[k],
        value: k === 'severity' ? severity[String(v)] || String(v) : String(v ?? 'Sin notas'),
      }));
  }
  constructor() {
    effect(() => {
      this.animalId();
      this.entryId();
      this.request++;
      this.opened.set(false);
      this.context.set(null);
      this.error.set('');
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
  }
}
