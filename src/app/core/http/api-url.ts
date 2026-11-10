import { InjectionToken, isDevMode } from '@angular/core';

export const API_URL = new InjectionToken<string>('Pelifolk API URL', {
  providedIn: 'root',
  factory: () => isDevMode() ? 'http://localhost:8000/api/v1' : '/api/v1',
});
