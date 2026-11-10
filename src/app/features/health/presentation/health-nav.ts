import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-health-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `<nav
    aria-label="Secciones de sanidad"
    class="mb-6 flex flex-wrap gap-x-5 border-b border-stone-200 text-sm dark:border-white/10"
  >
    <a
      routerLink="/dashboard/health"
      routerLinkActive="border-green-800"
      [routerLinkActiveOptions]="{ exact: true }"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Casos y observaciones</a
    ><a
      routerLink="/dashboard/health/products"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Productos</a
    >
    <a routerLink="/dashboard/health/ingredients" routerLinkActive="border-green-800" ariaCurrentWhenActive="page" class="border-b-2 border-transparent py-3">Principios activos</a>
    <a
      routerLink="/dashboard/health/programs"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Programas y avisos</a
    >
    <a
      routerLink="/dashboard/health/withdrawals"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Retiro sanitario</a
    >
    <a
      routerLink="/dashboard/health/reactions"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Alergias y reacciones</a
    >
    <a
      routerLink="/dashboard/health/incidents"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Incidentes</a
    >
    <a
      routerLink="/dashboard/health/reviews"
      routerLinkActive="border-green-800"
      ariaCurrentWhenActive="page"
      class="border-b-2 border-transparent py-3"
      >Revisiones clínicas</a
    >
  </nav>`,
})
export class HealthNav {}
