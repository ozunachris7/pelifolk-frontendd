import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Eye, Network } from 'lucide-angular';
import { Animal, sexLabel } from '../domain/animal';
import { exitLabel } from '../../exits/domain/exits';
@Component({
  selector: 'app-family-node',
  imports: [DatePipe, RouterLink, LucideAngularModule],
  template: `
    <article
      class="h-full min-w-0 border border-stone-200 bg-white p-4 dark:border-white/15 dark:bg-stone-900"
      [class.border-green-800]="current()"
      [class.dark:border-green-400]="current()"
    >
      <p class="mb-3 text-[11px] uppercase tracking-wider text-stone-500">{{ relation() }}</p>
      @if (animal(); as a) {
        @if (current()) {
          <h3 class="break-words text-lg font-semibold">{{ a.name || a.siniiga }}</h3>
        } @else {
          <a
            [routerLink]="['/dashboard/genealogy', a.id]"
            [attr.aria-label]="'Ver genealogía de ' + (a.name || a.siniiga)"
            class="block break-words font-medium underline decoration-stone-300 underline-offset-4 hover:text-green-800 dark:decoration-white/20 dark:hover:text-green-400"
            >{{ a.name || a.siniiga }}</a
          >
        }
        @if (a.name && a.siniiga) {
          <p class="mt-1 break-all text-xs text-stone-500">{{ a.siniiga }}</p>
        }
        <p class="mt-3 text-xs text-stone-500">
          {{ sexLabel(a.sex) }} ·
          {{ a.birth_date ? (a.birth_date | date: 'dd/MM/yyyy') : 'Nacimiento sin registrar' }}
        </p>
        <p class="mt-1 text-xs text-stone-500">
          {{ status(a.status || 'active') }}{{ a.is_breeder ? ' · Reproductor' : '' }}
        </p>
        <div class="mt-4 flex flex-wrap gap-4 text-xs">
          <button
            type="button"
            (click)="view.emit(a)"
            [attr.aria-label]="'Ver ficha de ' + (a.name || a.siniiga)"
            class="inline-flex items-center gap-1.5 hover:text-green-800 dark:hover:text-green-400"
          >
            <lucide-icon [img]="eye" [size]="14" />Ficha
          </button>
          @if (!current()) {
            <a
              [routerLink]="['/dashboard/genealogy', a.id]"
              class="inline-flex items-center gap-1.5 hover:text-green-800 dark:hover:text-green-400"
              ><lucide-icon [img]="network" [size]="14" />Explorar familia</a
            >
          }
        </div>
      } @else {
        <p class="text-sm text-stone-500">No registrado</p>
      }
    </article>
  `,
})
export class FamilyNode {
  readonly animal = input<Animal | null>(null);
  readonly relation = input.required<string>();
  readonly current = input(false);
  readonly view = output<Animal>();
  protected readonly sexLabel = sexLabel;
  protected readonly status = exitLabel;
  protected readonly eye = Eye;
  protected readonly network = Network;
}
