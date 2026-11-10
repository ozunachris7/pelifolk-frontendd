import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <dialog
      #dialog
      aria-labelledby="modal-title"
      (cancel)="cancel($event)"
      (click)="outside($event)"
      class="fixed inset-0 m-auto  w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/45 dark:border-white/10 dark:bg-[#171717] dark:text-stone-100"
    >
      <div class="flex max-h-[90dvh] flex-col">
        <div
          class="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-6 py-5 sm:px-8 dark:border-white/10"
        >
          <h2 id="modal-title" class="text-xl font-medium tracking-tight">{{ title() }}</h2>
          <button
            type="button"
            aria-label="Cerrar diálogo"
            [disabled]="busy()"
            (click)="dismiss.emit()"
            class="-mt-1 rounded-lg px-3 py-1 text-xl text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ×
          </button>
        </div>
        <div class="modal-scroll min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }

  protected outside(event: MouseEvent): void {
    if (event.target !== this.dialog().nativeElement || this.busy()) return;
    const rect = this.dialog().nativeElement.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.dismiss.emit();
  }
}
