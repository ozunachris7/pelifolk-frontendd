import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { API_URL } from "../../../core/http/api-url";
import {
  Consumption,
  ConsumptionInput,
  ConsumptionPage,
  Feed,
  Page,
  Price,
  Target,
  TargetKind,
  Unit,
} from "../domain/feeding";
@Injectable()
export class FeedingRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  units() {
    return firstValueFrom(
      this.http.get<Unit[]>(`${this.api}/feeding/units`).pipe(timeout(15000)),
    );
  }
  feeds(q: string, offset = 0, limit = 25) {
    return firstValueFrom(
      this.http
        .get<Page<Feed>>(`${this.api}/feeding/feeds`, {
          params: { q, offset, limit },
        })
        .pipe(timeout(15000)),
    );
  }
  saveFeed(name: string, unit_id: number, id?: string, initial_price?: Price) {
    const path = `${this.api}/feeding/feeds`;
    return firstValueFrom(
      (id
        ? this.http.put<Feed>(`${path}/${id}`, { name, unit_id })
        : this.http.post<Feed>(path, { name, unit_id, initial_price })
      ).pipe(timeout(15000)),
    );
  }
  prices(id: string) {
    return firstValueFrom(
      this.http
        .get<Price[]>(`${this.api}/feeding/feeds/${id}/prices`)
        .pipe(timeout(15000)),
    );
  }
  addPrice(id: string, effective_from: string, unit_cost: string) {
    return firstValueFrom(
      this.http
        .post<Price>(`${this.api}/feeding/feeds/${id}/prices`, {
          effective_from,
          unit_cost,
        })
        .pipe(timeout(15000)),
    );
  }
  targets(kind: TargetKind, q: string) {
    return firstValueFrom(
      this.http
        .get<Target[]>(`${this.api}/feeding/target-options`, {
          params: { kind, q },
        })
        .pipe(timeout(15000)),
    );
  }
  consumptions(
    q: string,
    date_from: string,
    date_to: string,
    offset = 0,
    target?: { kind: TargetKind; id: string },
  ) {
    const params: Record<string, string | number> = { q, offset, limit: 25 };
    if (date_from) params["date_from"] = date_from;
    if (date_to) params["date_to"] = date_to;
    if (target)
      params[target.kind === "animal" ? "animal_id" : "group_id"] = target.id;
    return firstValueFrom(
      this.http
        .get<ConsumptionPage>(`${this.api}/feeding/consumptions`, { params })
        .pipe(timeout(15000)),
    );
  }
  create(input: ConsumptionInput) {
    return firstValueFrom(
      this.http
        .post<Consumption>(`${this.api}/feeding/consumptions`, input)
        .pipe(timeout(15000)),
    );
  }
}
