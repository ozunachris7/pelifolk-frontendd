import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-management-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav
      aria-label="Secciones de manejo"
      class="mb-6 flex flex-wrap gap-5 border-b border-stone-200 text-sm dark:border-white/10"
    >
      <a
        routerLink="/dashboard/management"
        routerLinkActive="border-green-800"
        [routerLinkActiveOptions]="{ exact: true }"
        ariaCurrentWhenActive="page"
        class="border-b-2 border-transparent py-3"
        >Pesajes</a
      ><a
        routerLink="/dashboard/management/weanings"
        routerLinkActive="border-green-800"
        ariaCurrentWhenActive="page"
        class="border-b-2 border-transparent py-3"
        >Destetes</a
      ><a
        routerLink="/dashboard/management/comparison"
        routerLinkActive="border-green-800"
        ariaCurrentWhenActive="page"
        class="border-b-2 border-transparent py-3"
        >Comparar pesos</a
      >
    </nav>
  `,
})
export class ManagementNav {}
