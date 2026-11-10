import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { AuditActor, AuditDetail, AuditFilters, AuditPage } from '../domain/audit';
@Injectable({ providedIn: 'root' })
export class AuditRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  list(filters: AuditFilters, offset = 0) {
    const params: Record<string, string | number> = { offset, limit: 25 };
    for (const key of ['q', 'module', 'action', 'user_id', 'record_id', 'table'] as const) {
      if (filters[key].trim()) params[key] = filters[key].trim();
    }
    if (filters.date_from) params['date_from'] = this.boundary(filters.date_from);
    if (filters.date_to) params['date_before'] = this.boundary(filters.date_to, true);
    return firstValueFrom(
      this.http.get<AuditPage>(`${this.api}/audit`, { params }).pipe(timeout(15000)),
    );
  }
  users(q: string) {
    return firstValueFrom(
      this.http
        .get<AuditActor[]>(`${this.api}/audit/users`, { params: { q, limit: 50 } })
        .pipe(timeout(15000)),
    );
  }
  detail(id: string) {
    return firstValueFrom(
      this.http.get<AuditDetail>(`${this.api}/audit/${id}`).pipe(timeout(15000)),
    );
  }
  private boundary(day: string, next = false) {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date + (next ? 1 : 0)).toISOString();
  }
}
