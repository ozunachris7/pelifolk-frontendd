import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal(this.document.documentElement.classList.contains('dark'));
  readonly dark = this.state.asReadonly();

  toggle(): void {
    const dark = !this.state();
    this.state.set(dark);
    this.document.documentElement.classList.toggle('dark', dark);
    try {
      this.document.defaultView?.localStorage.setItem('pelifolk-theme', dark ? 'dark' : 'light');
    } catch {
      /* The theme also works when storage is unavailable. */
    }
  }
}
