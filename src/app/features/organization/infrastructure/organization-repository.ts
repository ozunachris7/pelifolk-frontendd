import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Provider } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../../../core/http/api-url';
import { ManageOrganization } from '../application/manage-organization';
import {
  AnimalOptionPage,
  AssignmentInput,
  Group,
  Location,
  LocationInput,
  LocationType,
  Membership,
  MembershipPage,
  NamedInput,
  OrganizationRepository,
} from '../domain/organization';
@Injectable()
export class HttpOrganizationRepository implements OrganizationRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  locations() {
    return firstValueFrom(this.http.get<Location[]>(`${this.api}/locations`).pipe(timeout(15_000)));
  }
  locationTypes() {
    return firstValueFrom(
      this.http.get<LocationType[]>(`${this.api}/location-types`).pipe(timeout(15_000)),
    );
  }
  createType(name: string) {
    return firstValueFrom(
      this.http.post<LocationType>(`${this.api}/location-types`, { name }).pipe(timeout(15_000)),
    );
  }
  saveLocation(input: LocationInput, id?: string) {
    return firstValueFrom(
      (id
        ? this.http.put<Location>(`${this.api}/locations/${id}`, input)
        : this.http.post<Location>(`${this.api}/locations`, input)
      ).pipe(timeout(15_000)),
    );
  }
  groups() {
    return firstValueFrom(this.http.get<Group[]>(`${this.api}/groups`).pipe(timeout(15_000)));
  }
  group(id: string) {
    return firstValueFrom(this.http.get<Group>(`${this.api}/groups/${id}`).pipe(timeout(15_000)));
  }
  saveGroup(input: NamedInput, id?: string) {
    return firstValueFrom(
      (id
        ? this.http.put<Group>(`${this.api}/groups/${id}`, input)
        : this.http.post<Group>(`${this.api}/groups`, input)
      ).pipe(timeout(15_000)),
    );
  }
  memberships(id: string, current: boolean, offset: number, limit: number) {
    return firstValueFrom(
      this.http
        .get<MembershipPage>(`${this.api}/groups/${id}/memberships`, {
          params: { current, offset, limit },
        })
        .pipe(timeout(15_000)),
    );
  }
  animalOptions(q: string) {
    return firstValueFrom(
      this.http
        .get<AnimalOptionPage>(`${this.api}/groups/animal-options`, { params: { q, limit: 50 } })
        .pipe(timeout(15_000)),
    );
  }
  assign(id: string, input: AssignmentInput) {
    return firstValueFrom(
      this.http
        .post<Membership[]>(`${this.api}/groups/${id}/assignments`, input)
        .pipe(timeout(15_000)),
    );
  }
  remove(groupId: string, animalId: string, effectiveDate: string) {
    return firstValueFrom(
      this.http
        .post<Membership>(`${this.api}/groups/${groupId}/animals/${animalId}/remove`, {
          effective_date: effectiveDate,
        })
        .pipe(timeout(15_000)),
    );
  }
}
export const ORGANIZATION_PROVIDERS: Provider[] = [
  HttpOrganizationRepository,
  {
    provide: ManageOrganization,
    useFactory: () => new ManageOrganization(inject(HttpOrganizationRepository)),
  },
];
