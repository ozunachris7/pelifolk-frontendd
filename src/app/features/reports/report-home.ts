import { Component, inject, signal } from '@angular/core';
import { Session } from '../../core/auth/session';
import { AnimalReport } from './animal-report';
import { HealthReport } from './health-report';
import { BreedingReport } from './breeding-report';
import { FinanceReport } from './finance-report';
import { FeedingReport } from './feeding-report';
import { WeightReport } from './weight-report';
import { WeaningReport } from './weaning-report';
@Component({
  selector: 'app-report-home',
  imports: [
    AnimalReport,
    HealthReport,
    BreedingReport,
    FinanceReport,
    FeedingReport,
    WeightReport,
    WeaningReport,
  ],
  template: `
    <div
      class="mx-auto mb-6 flex max-w-6xl flex-wrap gap-6 border-b border-stone-200 text-sm dark:border-white/10"
      role="tablist"
      aria-label="Tipo de reporte"
    >
      @if (animals) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'animals'"
          [class.border-green-800]="tab() === 'animals'"
          [class.dark:border-green-400]="tab() === 'animals'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('animals')"
        >
          Animales
        </button>
      }
      @if (health) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'health'"
          [class.border-green-800]="tab() === 'health'"
          [class.dark:border-green-400]="tab() === 'health'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('health')"
        >
          Sanidad
        </button>
      }
      @if (breeding) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'breeding'"
          [class.border-green-800]="tab() === 'breeding'"
          [class.dark:border-green-400]="tab() === 'breeding'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('breeding')"
        >
          Reproducción
        </button>
      }
      @if (finance) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'finance'"
          [class.border-green-800]="tab() === 'finance'"
          [class.dark:border-green-400]="tab() === 'finance'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('finance')"
        >
          Economía
        </button>
      }
      @if (feeding) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'feeding'"
          [class.border-green-800]="tab() === 'feeding'"
          [class.dark:border-green-400]="tab() === 'feeding'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('feeding')"
        >
          Alimentación
        </button>
      }
      @if (weights) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'weights'"
          [class.border-green-800]="tab() === 'weights'"
          [class.dark:border-green-400]="tab() === 'weights'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('weights')"
        >
          Pesajes y crecimiento
        </button>
      }
      @if (weights) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'weanings'"
          [class.border-green-800]="tab() === 'weanings'"
          [class.dark:border-green-400]="tab() === 'weanings'"
          class="border-b-2 border-transparent px-1 pb-3"
          (click)="tab.set('weanings')"
        >
          Destetes
        </button>
      }
    </div>
    @if (tab() === 'animals' && animals) {
      <app-animal-report />
    } @else if (tab() === 'health' && health) {
      <app-health-report />
    } @else if (tab() === 'breeding' && breeding) {
      <app-breeding-report />
    } @else if (tab() === 'finance' && finance) {
      <app-finance-report />
    } @else if (tab() === 'feeding' && feeding) {
      <app-feeding-report />
    } @else if (tab() === 'weanings' && weights) {
      <app-weaning-report />
    } @else if (weights) {
      <app-weight-report />
    } @else {
      <p class="py-12 text-sm text-stone-500">No tienes permiso para consultar reportes.</p>
    }
  `,
})
export class ReportHome {
  private readonly session = inject(Session);
  protected readonly animals = !!this.session.user()?.permissions.includes('animals:read');
  protected readonly health = !!this.session.user()?.permissions.includes('health:read');
  protected readonly breeding = !!this.session.user()?.permissions.includes('breeding:read');
  protected readonly finance = !!this.session.user()?.permissions.includes('finance:read');
  protected readonly feeding = !!this.session.user()?.permissions.includes('feeding:read');
  protected readonly weights = !!this.session.user()?.permissions.includes('weights:read');
  protected readonly tab = signal(
    this.animals
      ? 'animals'
      : this.health
        ? 'health'
        : this.breeding
          ? 'breeding'
          : this.finance
            ? 'finance'
            : this.feeding
              ? 'feeding'
              : 'weights',
  );
}
