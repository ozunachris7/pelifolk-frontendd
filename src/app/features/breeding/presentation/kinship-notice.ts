import { Component, input } from '@angular/core';
import { LucideAngularModule, TriangleAlert, Info } from 'lucide-angular';
import { Kinship, animalLabel } from '../domain/breeding';
@Component({
  selector: 'app-kinship-notice',
  imports: [LucideAngularModule],
  template: `
    <aside
      class="min-w-0 rounded-lg border border-stone-200 p-4 text-sm dark:border-white/15"
      [class.border-amber-500]="value().status === 'related'"
      aria-live="polite"
    >
      <div class="flex items-start gap-2">
        <lucide-icon
          [img]="value().status === 'related' ? warning : info"
          [size]="18"
          class="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <h3 class="font-medium">
          {{
            value().status === 'related'
              ? 'Parentesco registrado entre estos animales'
              : value().status === 'insufficient_data'
                ? 'Datos genealógicos incompletos'
                : 'Sin parentesco encontrado hasta abuelos'
          }}
        </h3>
      </div>
      @if (historical()) {
        <p class="mt-2 text-xs text-stone-500">Comprobación conservada al registrar esta monta.</p>
      }
      @if (value().status === 'related') {
        <p class="mt-2 text-xs text-stone-500">
          {{
            historical()
              ? 'Se encontraron estos vínculos en los datos registrados:'
              : 'Revisa estos vínculos antes de guardar la monta:'
          }}
        </p>
        @if (sharedParents() === 2) {
          <p class="mt-3 font-medium">
            Comparten madre y padre registrados: son hermanos según estos datos.
          </p>
        } @else if (sharedParents() === 1) {
          <p class="mt-3 font-medium">Comparten al menos un progenitor registrado.</p>
        }
        <ul class="mt-3 space-y-3">
          @for (m of value().matches; track m.ancestor.id) {
            <li class="min-w-0 border-l-2 border-amber-600 pl-3">
              <p class="break-words font-medium">
                {{ matchLabel(m.kind) }} · {{ label(m.ancestor) }}
              </p>
              <p class="mt-1 break-words text-xs text-stone-500">
                Hembra: {{ paths(m.female_paths) }} · Macho: {{ paths(m.male_paths) }}
              </p>
            </li>
          }
        </ul>
      }
      @if (!value().lineage_complete) {
        <p class="mt-3 text-xs text-stone-500">
          Faltan datos de padres o abuelos.
          @if (value().status === 'related') {
            Podrían existir otros vínculos sin registrar.
          } @else {
            No se puede descartar un parentesco con esta información.
          }
        </p>
        @if (value().missing_female.length) {
          <p class="mt-2 break-words text-xs text-stone-500">
            Hembra, falta: {{ paths(value().missing_female) }}.
          </p>
        }
        @if (value().missing_male.length) {
          <p class="mt-1 break-words text-xs text-stone-500">
            Macho, falta: {{ paths(value().missing_male) }}.
          </p>
        }
      }
      @if (value().invalid_lineage) {
        <p class="mt-3 text-xs text-red-600">
          Hay datos genealógicos inconsistentes. Revisa los padres y abuelos registrados.
        </p>
      }
      <p class="mt-3 text-xs text-stone-500">
        Se comparan padres y abuelos conocidos. Esta revisión no descarta parentescos más lejanos.
      </p>
    </aside>
  `,
})
export class KinshipNotice {
  readonly value = input.required<Kinship>();
  readonly historical = input(false);
  protected readonly warning = TriangleAlert;
  protected readonly info = Info;
  protected readonly label = animalLabel;
  protected readonly matchLabel = (kind: Kinship['matches'][number]['kind']) =>
    ({
      direct_ancestor: 'Relación directa con un progenitor o abuelo',
      shared_parent: 'Progenitor compartido',
      shared_grandparent: 'Abuelo compartido',
      parent_grandparent: 'Progenitor de uno y abuelo del otro',
    })[kind];
  protected readonly sharedParents = () =>
    this.value().matches.filter((m) => m.kind === 'shared_parent').length;
  protected readonly paths = (values: string[]) =>
    values
      .map((p) =>
        p === 'self'
          ? 'El animal seleccionado'
          : p
              .split('.')
              .map((x) => (x === 'mother' ? 'Madre' : 'Padre'))
              .join(' → '),
      )
      .join(', ');
}
