import { Session } from '../../../core/auth/session';
import { Component, computed, inject, input, OnDestroy, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { Followup, evolutionLabel, resultLabel } from '../domain/health';
@Component({
  selector: 'app-case-followups',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule],
  template: `
    <section class="mb-7 border-t border-stone-200 pt-5 dark:border-white/10">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Evolución y revisiones</h3>
        @if (allowedWrite() && !closed() && !open()) {
          <button
            type="button"
            data-testid="new-followup"
            (click)="start()"
            class="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-white/15"
          >
            <lucide-icon [img]="plus" [size]="15" aria-hidden="true" />Registrar evolución
          </button>
        }
      </div>
      @if (entries()[0]?.next_review_date && !closed()) {
        <p class="mb-4 text-sm">
          Próxima revisión: {{ entries()[0].next_review_date | date: 'dd/MM/yyyy' : 'UTC' }}
        </p>
      }
      @if (open() && !closed()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="mb-6">
          <fieldset [disabled]="busy()" class="min-w-0 space-y-4">
            <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="min-w-0">
                <label for="followup-date" class="mb-2 block text-xs">Fecha de seguimiento *</label
                ><input
                  id="followup-date"
                  type="date"
                  formControlName="date"
                  [min]="startDate()"
                  [max]="today"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
                />
              </div>
              <div class="min-w-0">
                <label for="followup-evolution" class="mb-2 block text-xs">Evolución *</label
                ><select
                  id="followup-evolution"
                  formControlName="evolution"
                  class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
                >
                  <option value="improved">Mejoró</option>
                  <option value="unchanged">Sin cambios</option>
                  <option value="worsened">Empeoró</option>
                  <option value="recovered">Recuperado</option>
                </select>
              </div>
            </div>
            <div>
              <label for="followup-result" class="mb-2 block text-xs"
                >Resultado de los tratamientos del caso</label
              ><select
                id="followup-result"
                formControlName="treatment_result"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-[#171717]"
              >
                <option value="not_assessed">Aún no evaluado</option>
                <option value="effective">Efectivo</option>
                <option value="partially_effective">Parcialmente efectivo</option>
                <option value="not_effective">Sin efecto observado</option>
              </select>
            </div>
            <div>
              <label for="followup-notes" class="mb-2 block text-xs"
                >Evolución observada y acuerdos *</label
              ><textarea
                id="followup-notes"
                formControlName="notes"
                maxlength="5000"
                rows="4"
                placeholder="Describe cómo se encuentra el animal y qué se acordó en la revisión."
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              ></textarea>
            </div>
            <div>
              <label for="followup-review" class="mb-2 block text-xs">Próxima revisión</label
              ><input
                id="followup-review"
                type="date"
                formControlName="next_review_date"
                [min]="form.controls.date.value"
                class="w-full min-w-0 rounded-lg border border-stone-200 bg-transparent px-3 py-3 text-sm dark:border-white/15"
              />
              <p class="mt-2 text-xs text-stone-500">
                Dejarla vacía indica que este seguimiento no programa otra revisión. Se toma la
                fecha del seguimiento clínico más reciente.
              </p>
            </div>
            <p class="text-xs text-stone-500">
              Cada seguimiento se conserva. Marcar “Recuperado” no cierra automáticamente el caso.
            </p>
            @if (error()) {
              <p role="alert" class="text-sm text-red-600">{{ error() }}</p>
            }
            <div class="flex flex-wrap justify-end gap-3">
              <button type="button" (click)="open.set(false)" class="px-3 py-3 text-xs">
                Cancelar</button
              ><button type="submit" class="rounded-lg bg-green-900 px-4 py-3 text-xs text-white">
                {{ busy() ? 'Guardando…' : 'Guardar seguimiento' }}
              </button>
            </div>
          </fieldset>
        </form>
      }
      <ol class="space-y-5 border-l border-stone-200 pl-4 dark:border-white/10">
        @for (f of entries(); track f.id) {
          <li data-followup-entry>
            <p class="mb-2 text-xs text-stone-500">
              {{ f.date | date: 'dd/MM/yyyy' : 'UTC' }} · {{ f.recorded_by }}
            </p>
            <p class="text-sm font-medium">
              {{ evolutionLabel(f.evolution) }} · {{ resultLabel(f.treatment_result) }}
            </p>
            <p class="mt-2 whitespace-pre-wrap break-words text-sm">{{ f.notes }}</p>
            <p class="mt-2 text-xs text-stone-500">
              {{
                f.next_review_date
                  ? 'Revisión programada:'
                  : 'Sin próxima revisión en este registro'
              }}
              @if (f.next_review_date) {
                {{ f.next_review_date | date: 'dd/MM/yyyy' : 'UTC' }}
              }
            </p>
            @if (showCaseLinks()) {
              <button
                type="button"
                (click)="viewCase.emit(f.health_case_id)"
                class="mt-2 text-xs underline underline-offset-4"
              >
                Ver caso
              </button>
            }
          </li>
        } @empty {
          <li class="text-xs text-stone-500">Sin seguimientos registrados.</li>
        }
      </ol>
    </section>
  `,
})
export class CaseFollowups implements OnDestroy {
  readonly caseId = input.required<string>();
  readonly startDate = input.required<string>();
  readonly closed = input(false);
  readonly canWrite = input(false);
  private readonly session = inject(Session);
  protected readonly allowedWrite = computed(
    () =>
      this.canWrite() &&
      !!this.session.user()?.permissions.includes('health:read') &&
      !!this.session.user()?.permissions.includes('health:followups:create'),
  );
  readonly entries = input<Followup[]>([]);
  readonly showCaseLinks = input(false);
  readonly viewCase = output<string>();
  readonly saved = output<void>();
  readonly busyChange = output<boolean>();
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly plus = Plus;
  protected readonly evolutionLabel = evolutionLabel;
  protected readonly resultLabel = resultLabel;
  protected readonly today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected readonly form = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    evolution: ['improved' as Followup['evolution'], Validators.required],
    treatment_result: ['not_assessed' as Followup['treatment_result']],
    notes: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    next_review_date: [''],
  });
  ngOnDestroy() {
    this.destroyed = true;
  }
  protected start() {
    if (!this.allowedWrite() || this.closed()) return;
    const next = this.entries()[0]?.next_review_date;
    this.form.reset({
      date: this.today,
      evolution: 'improved',
      treatment_result: 'not_assessed',
      notes: '',
      next_review_date: next && next >= this.today ? next : '',
    });
    this.error.set('');
    this.open.set(true);
  }
  protected async save() {
    this.form.markAllAsTouched();
    if (!this.allowedWrite() || this.closed() || this.busy()) return;
    if (this.form.invalid) {
      this.error.set('Completa la fecha, evolución y notas del seguimiento.');
      return;
    }
    const v = this.form.getRawValue();
    if (v.date < this.startDate() || v.date > this.today) {
      this.error.set('La fecha debe estar entre el inicio del caso y hoy.');
      return;
    }
    if (v.next_review_date && v.next_review_date < v.date) {
      this.error.set('La próxima revisión no puede ser anterior al seguimiento.');
      return;
    }
    this.busy.set(true);
    this.busyChange.emit(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http
          .post<Followup>(`${this.api}/health/cases/${this.caseId()}/followups`, {
            ...v,
            notes: v.notes.trim(),
            next_review_date: v.next_review_date || null,
          })
          .pipe(timeout(15000)),
      );
      if (this.destroyed) return;
      this.open.set(false);
      this.busy.set(false);
      this.busyChange.emit(false);
      this.saved.emit();
    } catch (e) {
      if (!this.destroyed) this.error.set(apiError(e, 'No se pudo guardar el seguimiento.'));
    } finally {
      if (!this.destroyed && this.busy()) {
        this.busy.set(false);
        this.busyChange.emit(false);
      }
    }
  }
}
