import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { hasPermission } from '../../users/domain/access';
@Component({
  selector: 'app-organization-nav',
  imports: [RouterLink, RouterLinkActive],
  template: ` <nav
    aria-label="Organización del hato"
    class="mb-7 flex flex-wrap gap-7 border-b border-stone-200 text-sm dark:border-white/10"
  >
    @if (canLocations()) {
      <a
        routerLink="/dashboard/locations"
        [routerLinkActiveOptions]="{ exact: true }"
        routerLinkActive="border-b-2 border-green-800 font-medium text-green-900 dark:border-green-200 dark:text-green-200"
        ariaCurrentWhenActive="page"
        class="pb-4 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
        >Ubicaciones</a
      >
    }
    @if (canLocations()) {
      <a
        routerLink="/dashboard/locations/movements"
        routerLinkActive="border-b-2 border-green-800 font-medium text-green-900 dark:border-green-200 dark:text-green-200"
        ariaCurrentWhenActive="page"
        class="pb-4 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
        >Animales y traslados</a
      >
    }
    @if (canGroups()) {
      <a
        routerLink="/dashboard/groups"
        routerLinkActive="border-b-2 border-green-800 font-medium text-green-900 dark:border-green-200 dark:text-green-200"
        ariaCurrentWhenActive="page"
        class="pb-4 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
        >Lotes</a
      >
    }
  </nav>`,
})
export class OrganizationNav {
  private readonly session = inject(Session);
  protected readonly canLocations = computed(() =>
    hasPermission(this.session.user(), 'locations:read'),
  );
  protected readonly canGroups = computed(() => hasPermission(this.session.user(), 'groups:read'));
}
