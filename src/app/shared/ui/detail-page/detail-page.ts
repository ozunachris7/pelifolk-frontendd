import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-detail-page',
  imports: [LucideAngularModule],
  template: `
    <section aria-labelledby="detail-page-title" class="mx-auto w-full min-w-0 max-w-6xl">
      <header class="mb-8 border-b border-stone-200 pb-6 dark:border-white/10">
        <button
          type="button"
          [disabled]="busy()"
          (click)="dismiss.emit()"
          class="mb-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-stone-100"
        >
          <lucide-icon [img]="backIcon" class="h-4 w-4" aria-hidden="true" />
          {{ backLabel() }}
        </button>
        <h1
          #heading
          id="detail-page-title"
          tabindex="-1"
          class="scroll-mt-28 text-2xl font-medium tracking-tight text-stone-900 outline-none dark:text-stone-100"
        >
          {{ title() }}
        </h1>
      </header>
      <div class="min-w-0 pb-8"><ng-content /></div>
    </section>
  `,
})
export class DetailPage {
  readonly title = input.required<string>();
  readonly backLabel = input('Volver al listado');
  readonly busy = input(false);
  readonly dismiss = output<void>();
  protected readonly backIcon = ArrowLeft;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  constructor() {
    afterNextRender(() => {
      this.heading().nativeElement.focus({ preventScroll: true });
      this.heading().nativeElement.scrollIntoView?.({ block: 'start' });
    });
  }
}
