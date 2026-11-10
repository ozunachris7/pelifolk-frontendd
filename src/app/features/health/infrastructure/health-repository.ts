import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import {
  HealthProgram,
  HealthProgramInput,
  ProgramSchedule,
  ProgramApplication,
  Product,
  Ingredient,
  ProductInput,
  Treatment,
  TreatmentInput,
  TreatmentCatalogs,
  Diagnosis,
  Severity,
  AnimalOption,
  CaseDetail,
  CaseStatus,
  HealthCase,
  HealthHistory,
  Observation,
  Page,
} from '../domain/health';
@Injectable()
export class HealthRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  cases(q: string, status: string, offset: number) {
    return firstValueFrom(
      this.http
        .get<Page<HealthCase>>(`${this.api}/health/cases`, {
          params: { q, offset, limit: 25, ...(status ? { status } : {}) },
        })
        .pipe(timeout(15000)),
    );
  }
  observations(q: string, offset: number) {
    return firstValueFrom(
      this.http
        .get<Page<Observation>>(`${this.api}/health/observations`, {
          params: { q, offset, limit: 25 },
        })
        .pipe(timeout(15000)),
    );
  }
  options(q: string) {
    return firstValueFrom(
      this.http
        .get<AnimalOption[]>(`${this.api}/health/animal-options`, { params: { q, limit: 50 } })
        .pipe(timeout(15000)),
    );
  }
  createObservation(input: { animal_id: string; date: string; observation: string }) {
    return firstValueFrom(
      this.http.post<Observation>(`${this.api}/health/observations`, input).pipe(timeout(15000)),
    );
  }
  createCase(input: {
    animal_id: string;
    start_date: string;
    reason: string;
    notes: string | null;
  }) {
    return firstValueFrom(
      this.http.post<HealthCase>(`${this.api}/health/cases`, input).pipe(timeout(15000)),
    );
  }
  detail(id: string) {
    return firstValueFrom(
      this.http.get<CaseDetail>(`${this.api}/health/cases/${id}`).pipe(timeout(15000)),
    );
  }
  status(
    id: string,
    input: { expected_status: CaseStatus; status: CaseStatus; closed_date: string | null },
  ) {
    return firstValueFrom(
      this.http
        .patch<HealthCase>(`${this.api}/health/cases/${id}/status`, input)
        .pipe(timeout(15000)),
    );
  }
  history(id: string) {
    return firstValueFrom(
      this.http.get<HealthHistory>(`${this.api}/health/animals/${id}/history`).pipe(timeout(15000)),
    );
  }
  createDiagnosis(id: string, input: { date: string; diagnosis: string; severity: Severity }) {
    return firstValueFrom(
      this.http
        .post<Diagnosis>(`${this.api}/health/cases/${id}/diagnoses`, input)
        .pipe(timeout(15000)),
    );
  }
  catalogs() {
    return firstValueFrom(
      this.http.get<TreatmentCatalogs>(`${this.api}/health/catalogs`).pipe(timeout(15000)),
    );
  }
  products(q: string, active: boolean | null, offset = 0, limit = 25) {
    return firstValueFrom(
      this.http
        .get<Page<Product>>(`${this.api}/health/products`, {
          params: { q, offset, limit, ...(active === null ? {} : { active }) },
        })
        .pipe(timeout(15000)),
    );
  }
  ingredients(q = '', offset = 0, limit = 25) {
    return firstValueFrom(this.http.get<Page<Ingredient>>(`${this.api}/health/ingredients`,{params:{q,offset,limit}}).pipe(timeout(15000)));
  }
  saveIngredient(name: string,id?: number) {
    const path=`${this.api}/health/ingredients`;
    return firstValueFrom((id ? this.http.put<Ingredient>(`${path}/${id}`,{name}) : this.http.post<Ingredient>(path,{name})).pipe(timeout(15000)));
  }
  deleteIngredient(id: number) { return firstValueFrom(this.http.delete<void>(`${this.api}/health/ingredients/${id}`).pipe(timeout(15000))); }
  saveProduct(input: ProductInput, id?: string) {
    return firstValueFrom(
      (id
        ? this.http.put<Product>(`${this.api}/health/products/${id}`, input)
        : this.http.post<Product>(`${this.api}/health/products`, input)
      ).pipe(timeout(15000)),
    );
  }
  createTreatment(id: string, input: TreatmentInput) {
    return firstValueFrom(
      this.http
        .post<Treatment>(`${this.api}/health/cases/${id}/treatments`, input)
        .pipe(timeout(15000)),
    );
  }
  programs(q: string, active: boolean | null, offset = 0) {
    return firstValueFrom(
      this.http
        .get<Page<HealthProgram>>(`${this.api}/health/programs`, {
          params: { q, offset, limit: 25, ...(active === null ? {} : { active }) },
        })
        .pipe(timeout(15000)),
    );
  }
  saveProgram(input: HealthProgramInput, id?: string) {
    return firstValueFrom(
      (id
        ? this.http.put<HealthProgram>(`${this.api}/health/programs/${id}`, input)
        : this.http.post<HealthProgram>(`${this.api}/health/programs`, input)
      ).pipe(timeout(15000)),
    );
  }
  schedule(id: string, q: string, state: string, offset = 0) {
    return firstValueFrom(
      this.http
        .get<ProgramSchedule>(`${this.api}/health/programs/${id}/schedule`, {
          params: { q, state, offset, limit: 25 },
        })
        .pipe(timeout(15000)),
    );
  }
  applyProgram(id: string, input: ProgramApplication) {
    return firstValueFrom(
      this.http
        .post<Treatment>(`${this.api}/health/programs/${id}/applications`, input)
        .pipe(timeout(15000)),
    );
  }
}
