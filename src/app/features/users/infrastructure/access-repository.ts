import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Provider } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { ManageAccess } from '../application/manage-access';
import { AccessRepository, Role, RoleInput, User, UserChanges, UserInput } from '../domain/access';

@Injectable()
export class HttpAccessRepository implements AccessRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  users(offset: number, limit: number): Promise<User[]> {
    return firstValueFrom(
      this.http
        .get<User[]>(`${this.api}/users`, {
          params: { offset, limit },
        })
        .pipe(timeout(15_000)),
    );
  }
  roles(): Promise<Role[]> {
    return firstValueFrom(this.http.get<Role[]>(`${this.api}/roles`).pipe(timeout(15_000)));
  }
  permissions(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.api}/roles/permissions`).pipe(timeout(15_000)),
    );
  }
  createUser(input: UserInput): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.api}/users`, input).pipe(timeout(15_000)));
  }
  updateUser(id: string, input: UserChanges): Promise<User> {
    return firstValueFrom(
      this.http.patch<User>(`${this.api}/users/${id}`, input).pipe(timeout(15_000)),
    );
  }
  deactivateUser(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.api}/users/${id}`).pipe(timeout(15_000)));
  }
  createRole(input: RoleInput): Promise<Role> {
    return firstValueFrom(this.http.post<Role>(`${this.api}/roles`, input).pipe(timeout(15_000)));
  }
  updateRole(id: string, input: RoleInput): Promise<Role> {
    return firstValueFrom(
      this.http.put<Role>(`${this.api}/roles/${id}`, input).pipe(timeout(15_000)),
    );
  }
  deleteRole(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.api}/roles/${id}`).pipe(timeout(15_000)));
  }
}

export const ACCESS_PROVIDERS: Provider[] = [
  HttpAccessRepository,
  { provide: ManageAccess, useFactory: () => new ManageAccess(inject(HttpAccessRepository)) },
];
