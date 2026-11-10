import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import {
  Animal,
  BirthType,
  BreedingEvent,
  EventPage,
  History,
  Kind,
  Kinship,
} from '../domain/breeding';
@Injectable()
export class BreedingRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  page(kind: Kind, q: string, offset = 0, animal_id?: string) {
    return firstValueFrom(
      this.http
        .get<EventPage>(`${this.api}/breeding/events`, {
          params: { kind, q, offset, limit: 25, ...(animal_id ? { animal_id } : {}) },
        })
        .pipe(timeout(15000)),
    );
  }
  options(q: string, sex: string) {
    return firstValueFrom(
      this.http
        .get<Animal[]>(`${this.api}/breeding/animal-options`, { params: { q, sex } })
        .pipe(timeout(15000)),
    );
  }
  types() {
    return firstValueFrom(
      this.http.get<BirthType[]>(`${this.api}/breeding/birth-types`).pipe(timeout(15000)),
    );
  }
  kinship(animal_id: string, male_id: string) {
    return firstValueFrom(
      this.http
        .get<Kinship>(`${this.api}/breeding/kinship`, { params: { animal_id, male_id } })
        .pipe(timeout(15000)),
    );
  }
  create(kind: Kind, input: Record<string, unknown>) {
    return firstValueFrom(
      this.http
        .post<BreedingEvent>(
          `${this.api}/breeding/${{ mating: 'matings', pregnancy: 'pregnancy-diagnoses', birth: 'births' }[kind]}`,
          input,
        )
        .pipe(timeout(15000)),
    );
  }
  history(id: string) {
    return firstValueFrom(
      this.http.get<History>(`${this.api}/breeding/animals/${id}/history`).pipe(timeout(15000)),
    );
  }
}
