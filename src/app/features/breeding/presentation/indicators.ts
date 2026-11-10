import { DetailPage } from '../../../shared/ui/detail-page/detail-page';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from '../../../core/auth/session';
import { API_URL } from '../../../core/http/api-url';
import { apiError } from '../../../core/http/api-error';
import { physicalAnimalLabel } from '../../animals/domain/physical';
import {
  IndicatorPage,
  IndicatorRow,
  IndicatorDetail,
  IndicatorSection,
  diagnosisLabel,
  followupLabel,
} from '../domain/indicators';
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-indicators',
  imports: [DetailPage, DatePipe, DecimalPipe, RouterLink, ReactiveFormsModule],
  templateUrl: './indicators.html',
})
export class Indicators implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly allowed = !!this.session.user()?.permissions.includes('breeding:read');
  protected readonly today = today();
  protected readonly label = physicalAnimalLabel;
  protected readonly diagnosisLabel = diagnosisLabel;
  protected readonly followupLabel = followupLabel;
  protected readonly form = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    date_from: [''],
    date_to: [''],
    as_of: [this.today, Validators.required],
    age_days: [
      60,
      [Validators.required, Validators.min(1), Validators.max(730), Validators.pattern(/^\d+$/)],
    ],
  });
  protected readonly page = signal<IndicatorPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly animalFilter = signal(
    this.route.snapshot.queryParamMap.get('animal_id') || '',
  );
  protected readonly selected = signal<IndicatorRow | null>(null);
  protected readonly section = signal<IndicatorSection>('birth_intervals');
  protected readonly detail = signal<IndicatorDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  private applied = {
    q: '',
    date_from: '',
    date_to: '',
    as_of: this.today,
    age_days: 60,
    animal_id: this.animalFilter(),
  };
  private detailFilters = { ...this.applied };
  private destroyed = false;
  private request = 0;
  private detailRequest = 0;
  constructor() {
    if (this.allowed) void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    this.detailRequest++;
  }
  search() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (
      this.form.invalid ||
      v.as_of > today() ||
      (v.date_from && v.date_to && v.date_from > v.date_to) ||
      (v.date_from && v.date_from > v.as_of) ||
      (v.date_to && v.date_to > v.as_of)
    ) {
      this.error.set(
        'Revisa las fechas: Desde ≤ Hasta ≤ Corte, sin fechas futuras. La edad debe ser un entero de 1 a 730 días.',
      );
      return;
    }
    this.applied = { ...v, q: v.q.trim(), animal_id: this.animalFilter() };
    void this.load();
  }
  clearAnimal() {
    this.animalFilter.set('');
    this.search();
  }
  async load(offset = 0) {
    if (!this.allowed) return;
    const n = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const params = Object.fromEntries(Object.entries(this.applied).filter(([, v]) => v !== ''));
    try {
      const p = await firstValueFrom(
        this.http
          .get<IndicatorPage>(`${this.api}/breeding/indicators`, {
            params: { ...params, offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.request && !this.destroyed) this.page.set(p);
    } catch (e) {
      if (n === this.request && !this.destroyed) {
        this.page.set(null);
        this.error.set(apiError(e, 'No se pudieron calcular los indicadores.'));
      }
    } finally {
      if (n === this.request && !this.destroyed) this.loading.set(false);
    }
  }
  view(row: IndicatorRow) {
    this.selected.set(row);
    this.detailFilters = { ...this.applied };
    this.section.set('birth_intervals');
    void this.loadDetail();
  }
  closeDetail() {
    this.detailRequest++;
    this.selected.set(null);
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(false);
  }
  switchSection(section: IndicatorSection) {
    this.section.set(section);
    void this.loadDetail();
  }
  async loadDetail(offset = 0) {
    const row = this.selected();
    if (!row || !this.allowed) return;
    const n = ++this.detailRequest;
    this.detailLoading.set(true);
    this.detail.set(null);
    this.detailError.set('');
    const { q, animal_id, ...f } = this.detailFilters;
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    try {
      const d = await firstValueFrom(
        this.http
          .get<IndicatorDetail>(`${this.api}/breeding/indicators/${row.animal.id}/details`, {
            params: { ...params, section: this.section(), offset, limit: 25 },
          })
          .pipe(timeout(15000)),
      );
      if (n === this.detailRequest && !this.destroyed) this.detail.set(d);
    } catch (e) {
      if (n === this.detailRequest && !this.destroyed)
        this.detailError.set(apiError(e, 'No se pudo consultar el cálculo.'));
    } finally {
      if (n === this.detailRequest && !this.destroyed) this.detailLoading.set(false);
    }
  }
}
