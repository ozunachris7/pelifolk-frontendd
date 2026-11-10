import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { InteractiveChart, ChartModel, ChartTone } from '../../../shared/ui/chart/chart';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { WeightRepository } from '../infrastructure/weight-repository';
import { AnimalOption, WeightHistory, animalLabel, dayNumber } from '../domain/weights';
import { ComparisonAnimalSelect } from './comparison-animal-select';
import { ManagementNav } from './management-nav';
const tones: ChartTone[] = ['blue', 'violet', 'amber', 'teal', 'green'];
const colors = ['#0284c7', '#7c3aed', '#b45309', '#0f766e', '#166534'];
@Component({
  selector: 'app-weight-comparison',
  imports: [DatePipe, DecimalPipe, InteractiveChart, ComparisonAnimalSelect, ManagementNav],
  templateUrl: './weight-comparison.html',
})
export class WeightComparison implements OnDestroy {
  private readonly repo = inject(WeightRepository);
  private readonly session = inject(Session);
  protected readonly allowed = computed(
    () => !!this.session.user()?.permissions.includes('weights:read'),
  );
  protected readonly animals = signal<AnimalOption[]>([]);
  protected readonly data = signal<WeightHistory[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected readonly from = signal(this.initialFrom());
  protected readonly to = signal(this.today);
  protected readonly selected = signal(-1);
  protected readonly label = animalLabel;
  protected readonly color = (index: number) => colors[index];
  protected readonly dates = computed(() =>
    [...new Set((this.data() ?? []).flatMap((h) => h.items.map((w) => w.date)))].sort(),
  );
  protected readonly currentDate = computed(() => this.dates()[this.selected()] ?? '');
  protected readonly graph = computed<ChartModel>(() => {
    const dates = this.dates();
    return {
      type: 'line',
      unit: 'kg',
      connectGaps: true,
      labels: dates,
      days: dates.map(dayNumber),
      titles: dates.map((d) =>
        new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(d + 'T00:00:00Z')),
      ),
      series: (this.data() ?? []).map((history, index) => ({
        label: animalLabel(history.animal),
        tone: tones[index],
        values: dates.map((day) => {
          const weight = history.items.find((w) => w.date === day);
          return weight ? Number(weight.weight_kg) : null;
        }),
      })),
    };
  });
  protected weight(history: WeightHistory, day: string) {
    return history.items.find((w) => w.date === day);
  }
  private request = 0;
  private destroyed = false;
  private initialFrom() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 5, 1).toLocaleDateString('en-CA');
  }
  private clear() {
    ++this.request;
    this.loading.set(false);
    this.data.set(null);
    this.error.set('');
    this.notice.set('');
    this.selected.set(-1);
  }
  protected add(animal: AnimalOption | null) {
    if (!animal || !this.allowed()) return;
    if (this.animals().some((a) => a.id === animal.id)) {
      this.notice.set('Ese animal ya está seleccionado.');
      return;
    }
    if (this.animals().length >= 5) {
      this.notice.set('Puedes comparar hasta cinco animales.');
      return;
    }
    this.clear();
    this.animals.update((rows) => [...rows, animal]);
  }
  protected remove(id: string) {
    this.clear();
    this.animals.update((rows) => rows.filter((a) => a.id !== id));
  }
  protected dateChange(kind: 'from' | 'to', value: string) {
    this.clear();
    (kind === 'from' ? this.from : this.to).set(value);
  }
  protected allDates() {
    this.clear();
    this.from.set('');
    this.to.set(this.today);
  }
  protected async compare() {
    if (!this.allowed()) return;
    this.clear();
    const animals = [...this.animals()],
      start = this.from(),
      finish = this.to();
    if (animals.length < 2 || animals.length > 5) {
      this.error.set('Selecciona entre dos y cinco animales.');
      return;
    }
    if (!finish || finish > this.today || (start && start > finish)) {
      this.error.set('Elige fechas en orden, sin superar hoy.');
      return;
    }
    const request = ++this.request;
    this.loading.set(true);
    try {
      const histories = await Promise.all(animals.map((animal) => this.repo.history(animal.id)));
      if (this.destroyed || request !== this.request || !this.allowed()) return;
      this.data.set(
        histories.map((history) => ({
          ...history,
          items: history.items
            .filter((w) => (!start || w.date >= start) && w.date <= finish)
            .sort((a, b) => a.date.localeCompare(b.date)),
        })),
      );
      this.selected.set(this.dates().length - 1);
    } catch (error) {
      if (!this.destroyed && request === this.request)
        this.error.set(apiError(error, 'No se pudo completar la comparación. Intenta de nuevo.'));
    } finally {
      if (!this.destroyed && request === this.request) this.loading.set(false);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.request;
  }
}
