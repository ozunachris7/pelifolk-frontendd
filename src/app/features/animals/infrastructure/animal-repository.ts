import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Provider } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { ManageAnimals } from '../application/manage-animals';
import {
  Animal,
  AnimalInput,
  AnimalPage,
  AnimalQuery,
  AnimalRepository,
  Breed,
} from '../domain/animal';

@Injectable()
export class HttpAnimalRepository implements AnimalRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  list(query: AnimalQuery) {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== '') params[key] = value;
    return firstValueFrom(
      this.http.get<AnimalPage>(`${this.api}/animals`, { params }).pipe(timeout(15_000)),
    );
  }
  get(id: string) {
    return firstValueFrom(this.http.get<Animal>(`${this.api}/animals/${id}`).pipe(timeout(15_000)));
  }
  save(input: AnimalInput, id?: string) {
    return firstValueFrom(
      (id
        ? this.http.put<Animal>(`${this.api}/animals/${id}`, input)
        : this.http.post<Animal>(`${this.api}/animals`, input)
      ).pipe(timeout(15_000)),
    );
  }
  breeds() {
    return firstValueFrom(this.http.get<Breed[]>(`${this.api}/breeds`).pipe(timeout(15_000)));
  }
  updateBreed(id: number, name: string) {
    return firstValueFrom(
      this.http.put<Breed>(`${this.api}/breeds/${id}`, { name }).pipe(timeout(15_000)),
    );
  }
  deleteBreed(id: number) {
    return firstValueFrom(this.http.delete<void>(`${this.api}/breeds/${id}`).pipe(timeout(15_000)));
  }
  createBreed(name: string) {
    return firstValueFrom(
      this.http.post<Breed>(`${this.api}/breeds`, { name }).pipe(timeout(15_000)),
    );
  }
}
export const ANIMAL_PROVIDERS: Provider[] = [
  HttpAnimalRepository,
  { provide: ManageAnimals, useFactory: () => new ManageAnimals(inject(HttpAnimalRepository)) },
];
