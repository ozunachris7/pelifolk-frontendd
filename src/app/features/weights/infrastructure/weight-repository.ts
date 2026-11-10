import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { AnimalOption, Weight, WeightHistory, WeightInput, WeightPage } from '../domain/weights';
@Injectable()
export class WeightRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  list(q: string, offset: number) {
    return firstValueFrom(
      this.http
        .get<WeightPage>(`${this.api}/weights`, { params: { q, offset, limit: 25 } })
        .pipe(timeout(15000)),
    );
  }
  options(q: string) {
    return firstValueFrom(
      this.http
        .get<AnimalOption[]>(`${this.api}/weights/animal-options`, { params: { q, limit: 50 } })
        .pipe(timeout(15000)),
    );
  }
  history(id: string) {
    return firstValueFrom(
      this.http
        .get<WeightHistory>(`${this.api}/weights/animals/${id}/history`)
        .pipe(timeout(15000)),
    );
  }
  create(input: WeightInput) {
    return firstValueFrom(
      this.http.post<Weight>(`${this.api}/weights`, input).pipe(timeout(15000)),
    );
  }
}
