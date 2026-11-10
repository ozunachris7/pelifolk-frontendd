import { Withdrawal } from '../../health/domain/withdrawal';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import {
  ExitAnimal,
  ExitHistory,
  ExitInput,
  ExitPage,
  ExitRecord,
  ExitType,
} from '../domain/exits';
@Injectable()
export class ExitRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  list(q: string, exit_type: ExitType | '', offset = 0) {
    return firstValueFrom(
      this.http
        .get<ExitPage>(`${this.api}/exits`, {
          params: { q, offset, limit: 25, ...(exit_type ? { exit_type } : {}) },
        })
        .pipe(timeout(15000)),
    );
  }
  options(q: string) {
    return firstValueFrom(
      this.http
        .get<ExitAnimal[]>(`${this.api}/exits/animal-options`, { params: { q } })
        .pipe(timeout(15000)),
    );
  }
  withdrawal(id: string, date: string) {
    return firstValueFrom(
      this.http
        .get<Withdrawal>(`${this.api}/exits/animals/${id}/withdrawal`, { params: { date } })
        .pipe(timeout(15000)),
    );
  }
  create(input: ExitInput) {
    return firstValueFrom(
      this.http.post<ExitRecord>(`${this.api}/exits`, input).pipe(timeout(15000)),
    );
  }
  history(id: string) {
    return firstValueFrom(
      this.http.get<ExitHistory>(`${this.api}/exits/animals/${id}/history`).pipe(timeout(15000)),
    );
  }
}
