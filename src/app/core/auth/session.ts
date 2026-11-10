import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../http/api-url';

const SESSION_KEY = 'pelifolk-session';
const REQUEST_TIMEOUT = 15_000;

export interface SessionUser {
  id: string;
  name: string;
  middle_name: string | null;
  paternal_lastname: string;
  maternal_lastname: string;
  email: string;
  phone: string | null;
  active: boolean;
  role_id: string;
  role_name: string;
  permissions: string[];
  profile_photo_url?: string | null;
}

interface LoginResponse {
  expires_in: number;
  user: SessionUser;
}

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private expiresAt: number | null = null;
  private checked = false;
  private generation = 0;
  private validation: Promise<boolean> | null = null;
  private readonly userState = signal<SessionUser | null>(null);
  readonly user = this.userState.asReadonly();
  readonly photoUrl = computed(() => {
    const path = this.userState()?.profile_photo_url;
    if (!path || !/^\/upload\/photos_profile\/[a-z0-9]+\.webp$/.test(path)) return null;
    const base = new URL(this.apiUrl, this.document.baseURI);
    return new URL(path, base.origin).href;
  });

  constructor() {
    // Remove tokens stored by earlier versions; session cookies remain browser-managed.
    try {
      this.document.defaultView?.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Cookie authentication also works when browser storage is unavailable.
    }
  }

  get revision(): number {
    return this.generation;
  }

  invalidate(): void {
    this.clearSession();
  }

  updateIdentity(user: SessionUser): void {
    if (this.userState()?.id === user.id) this.userState.set(user);
  }

  async login(email: string, password: string): Promise<void> {
    this.clearSession();
    const generation = this.generation;
    const response = await firstValueFrom(
      this.http
        .post<LoginResponse>(`${this.apiUrl}/auth/login`, {
          email: email.trim().toLowerCase(),
          password,
        })
        .pipe(timeout(REQUEST_TIMEOUT)),
    );
    if (generation !== this.generation) return;
    this.checked = true;
    this.expiresAt = Date.now() + response.expires_in * 1000;
    this.userState.set(response.user);
  }

  async isAuthenticated(refresh = false): Promise<boolean> {
    if (this.expiresAt !== null && Date.now() >= this.expiresAt) {
      this.clearSession();
      return false;
    }
    if (this.validation) return this.validation;
    if (this.checked && !refresh) return this.userState() !== null;
    const generation = this.generation;
    const validation = firstValueFrom(
      this.http.get<SessionUser>(`${this.apiUrl}/auth/me`).pipe(timeout(REQUEST_TIMEOUT)),
    )
      .then((user) => {
        if (generation !== this.generation) return false;
        this.checked = true;
        this.userState.set(user);
        return true;
      })
      .catch((error: unknown) => {
        if (generation === this.generation) {
          if (error instanceof HttpErrorResponse && error.status === 401) this.clearSession();
          else this.userState.set(null);
        }
        return false;
      })
      .finally(() => {
        if (this.validation === validation) this.validation = null;
      });
    this.validation = validation;
    return validation;
  }

  async logout(): Promise<void> {
    const generation = ++this.generation;
    this.validation = null;
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/auth/logout`, null).pipe(timeout(REQUEST_TIMEOUT)),
      );
    } catch (error) {
      // An expired session is already signed out. Other failures require a retry,
      // because JavaScript cannot delete an HttpOnly cookie.
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) throw error;
    }
    if (generation === this.generation) this.clearSession();
  }

  private clearSession(): void {
    this.generation++;
    this.validation = null;
    this.checked = true;
    this.expiresAt = null;
    this.userState.set(null);
  }
}
