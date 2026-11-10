import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronDown, LogOut, LucideAngularModule, Moon, Sun, UserRound } from 'lucide-angular';
import { Theme } from '../../../core/theme/theme';

@Component({
  selector: 'app-header',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './header.html',
  host: {
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class Header {
  protected readonly theme = inject(Theme);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly profileButton = viewChild<ElementRef<HTMLButtonElement>>('profileButton');
  protected readonly menuOpen = signal(false);
  protected readonly chevronIcon = ChevronDown;
  protected readonly sunIcon = Sun;
  protected readonly moonIcon = Moon;
  readonly userName = input<string | null>(null);
  readonly photoUrl = input<string | null>(null);
  readonly signedIn = input(false);
  readonly logout = output<void>();
  protected readonly logoutIcon = LogOut;
  protected readonly failedPhotoUrl = signal<string | null>(null);
  protected readonly userIcon = UserRound;

  protected closeOutside(event: Event): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }

  protected closeMenu(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.profileButton()?.nativeElement.focus();
    }
  }

  protected signOut(): void {
    this.closeMenu();
    this.logout.emit();
  }
}
