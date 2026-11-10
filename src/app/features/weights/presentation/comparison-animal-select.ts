import { Component, inject, signal, output, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
export interface ComparisonAnimal {
  id: string;
  name: string | null;
  siniiga: string | null;
}
@Component({
  selector: 'app-comparison-animal-select',
  host: { class: 'block min-w-0' },
  template: `
    <div class="relative" (focusout)="leave($event)">
      <label for="comparison-search" class="block text-xs leading-4">Agregar animal</label>
      <div
        class="mt-2 flex h-12 min-w-0 items-stretch rounded-lg border border-stone-200 dark:border-white/15"
      >
        <input
          id="comparison-search"
          role="combobox"
          autocomplete="off"
          maxlength="100"
          placeholder="Escribe nombre o SINIIGA"
          [value]="query()"
          [attr.aria-expanded]="opened()"
          aria-controls="comparison-options"
          aria-autocomplete="list"
          [attr.aria-activedescendant]="active() >= 0 ? 'comparison-option-' + active() : null"
          (focus)="open()"
          (input)="search($any($event.target).value)"
          (keydown)="key($event)"
          class="h-full min-w-0 w-full flex-1 rounded-lg bg-transparent px-3 py-0 text-sm"
        />
        <button
          type="button"
          aria-label="Limpiar selección de animal"
          (click)="choose(null)"
          class="px-3 text-stone-500"
        >
          ×
        </button>
        <button
          type="button"
          aria-label="Mostrar animales"
          (click)="open()"
          class="pr-3 text-stone-500"
        >
          ⌄
        </button>
      </div>
      @if (opened()) {
        <div
          class="absolute z-30 mt-1 w-full rounded-lg border border-stone-200 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-[#171717]"
        >
          <div
            id="comparison-options"
            role="listbox"
            aria-label="Animales"
            class="modal-scroll max-h-64 overflow-y-auto"
          >
            @for (a of options(); track a.id; let i = $index) {
              <button
                type="button"
                role="option"
                [id]="'comparison-option-' + i"
                [attr.aria-selected]="chosen === a.id"
                [class.bg-stone-100]="active() === i"
                (mousedown)="$event.preventDefault()"
                (click)="choose(a)"
                class="w-full rounded px-3 py-3 text-left text-sm hover:bg-stone-100 dark:hover:bg-white/5 dark:!bg-transparent"
              >
                {{ label(a) }}
              </button>
            }
          </div>
          @if (loading()) {
            <p role="status" class="px-3 py-3 text-xs text-stone-500">Buscando animales…</p>
          } @else if (failed()) {
            <p role="alert" class="px-3 py-3 text-xs">
              No se pudieron cargar los animales.
              <button type="button" (click)="fetch(query())" class="underline">Reintentar</button>
            </p>
          } @else if (!options().length) {
            <p role="status" class="px-3 py-3 text-xs text-stone-500">
              No hay animales que coincidan con tu búsqueda.
            </p>
          } @else if (options().length === 100) {
            <p class="px-3 py-2 text-xs text-stone-500">Escribe más para reducir los resultados.</p>
          }
        </div>
      }
    </div>
  `,
})
export class ComparisonAnimalSelect implements OnDestroy {
  private http = inject(HttpClient);
  private api = inject(API_URL);
  readonly selectedChange = output<ComparisonAnimal | null>();
  readonly pendingChange = output<boolean>();
  protected query = signal('');
  protected opened = signal(false);
  protected loading = signal(false);
  protected failed = signal(false);
  protected options = signal<ComparisonAnimal[]>([]);
  protected active = signal(-1);
  protected chosen = '';
  private request = 0;
  private timer?: ReturnType<typeof setTimeout>;
  protected label(a: ComparisonAnimal) {
    return [a.name, a.siniiga].filter(Boolean).join(' · ') || 'Sin identificación';
  }
  protected open() {
    this.opened.set(true);
    this.active.set(-1);
    void this.fetch(this.chosen ? '' : this.query());
  }
  protected search(q: string) {
    this.query.set(q);
    this.chosen = '';
    this.selectedChange.emit(null);
    this.pendingChange.emit(!!q.trim());
    this.request++;
    clearTimeout(this.timer);
    this.options.set([]);
    this.active.set(-1);
    this.opened.set(true);
    this.loading.set(true);
    this.timer = setTimeout(() => void this.fetch(q), 250);
  }
  protected async fetch(q: string) {
    const n = ++this.request;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const rows = await firstValueFrom(
        this.http
          .get<ComparisonAnimal[]>(this.api + '/weights/animal-options', {
            params: { include_exited: true, limit: 100, q: q.trim() },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request) this.options.set(rows);
    } catch {
      if (n === this.request) this.failed.set(true);
    } finally {
      if (n === this.request) this.loading.set(false);
    }
  }
  protected choose(a: ComparisonAnimal | null) {
    clearTimeout(this.timer);
    this.request++;
    this.loading.set(false);
    this.chosen = '';
    this.query.set('');
    this.opened.set(false);
    this.active.set(-1);
    this.selectedChange.emit(a);
    this.pendingChange.emit(false);
  }
  protected key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.opened.set(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.opened()) {
        this.open();
        return;
      }
      this.active.set(
        Math.max(
          -1,
          Math.min(this.options().length - 1, this.active() + (e.key === 'ArrowDown' ? 1 : -1)),
        ),
      );
    }
    if (e.key === 'Enter' && this.opened()) {
      e.preventDefault();
      const a = this.options()[this.active()];
      if (a) this.choose(a);
    }
  }
  protected leave(e: FocusEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
      this.opened.set(false);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
    this.request++;
  }
}
