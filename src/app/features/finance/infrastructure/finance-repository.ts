import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import {
  Category,
  Kind,
  MoneyInput,
  MoneyQuery,
  MoneyRecord,
  Page,
  Sale,
  SaleWeight,
  Summary,
  Supplier,
  SupplierInput,
} from '../domain/finance';
@Injectable()
export class FinanceRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private params(query: Record<string, string | number>) {
    return Object.fromEntries(
      Object.entries(query).filter(([k, v]) => v !== '' && (k !== 'category_id' || v !== 0)),
    );
  }
  categories(kind: Kind) {
    return firstValueFrom(
      this.http.get<Category[]>(`${this.api}/finance/categories/${kind}`).pipe(timeout(15000)),
    );
  }
  saveCategory(kind: Kind, name: string, id?: number) {
    const path = `${this.api}/finance/categories/${kind}`;
    return firstValueFrom(
      (id
        ? this.http.put<Category>(`${path}/${id}`, { name })
        : this.http.post<Category>(path, { name })
      ).pipe(timeout(15000)),
    );
  }
  deleteCategory(kind: Kind, id: number) {
    return firstValueFrom(
      this.http.delete<void>(`${this.api}/finance/categories/${kind}/${id}`).pipe(timeout(15000)),
    );
  }
  suppliers(q: string, active: string, offset = 0, limit = 25) {
    return firstValueFrom(
      this.http
        .get<Page<Supplier>>(`${this.api}/finance/suppliers`, {
          params: this.params({ q, active, offset, limit }),
        })
        .pipe(timeout(15000)),
    );
  }
  saveSupplier(input: SupplierInput, id?: string) {
    const path = `${this.api}/finance/suppliers`;
    return firstValueFrom(
      (id
        ? this.http.put<Supplier>(`${path}/${id}`, input)
        : this.http.post<Supplier>(path, input)
      ).pipe(timeout(15000)),
    );
  }
  money(kind: Kind, query: MoneyQuery) {
    return firstValueFrom(
      this.http
        .get<Page<MoneyRecord>>(
          `${this.api}/finance/${kind === 'expense' ? 'expenses' : 'incomes'}`,
          { params: this.params({ ...query, limit: 25 }) },
        )
        .pipe(timeout(15000)),
    );
  }
  saveMoney(kind: Kind, input: MoneyInput, id?: string) {
    const path = `${this.api}/finance/${kind === 'expense' ? 'expenses' : 'incomes'}`;
    return firstValueFrom(
      (id
        ? this.http.put<MoneyRecord>(`${path}/${id}`, input)
        : this.http.post<MoneyRecord>(path, input)
      ).pipe(timeout(15000)),
    );
  }
  summary(date_from: string, date_to: string) {
    return firstValueFrom(
      this.http
        .get<Summary>(`${this.api}/finance/summary`, {
          params: this.params({ date_from, date_to }),
        })
        .pipe(timeout(15000)),
    );
  }
  saleWeights(id: string) {
    return firstValueFrom(
      this.http.get<SaleWeight[]>(`${this.api}/finance/sales/${id}/weights`).pipe(timeout(15000)),
    );
  }
  sales(q: string, income_id?: string) {
    return firstValueFrom(
      this.http
        .get<Sale[]>(`${this.api}/finance/sale-options`, {
          params: this.params({ q, income_id: income_id ?? '' }),
        })
        .pipe(timeout(15000)),
    );
  }
}
