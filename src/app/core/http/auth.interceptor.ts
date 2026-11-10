import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Session } from '../auth/session';
import { API_URL } from './api-url';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const api = new URL(inject(API_URL), document.baseURI);
  const url = new URL(request.url, document.baseURI);
  const apiPath = api.pathname.replace(/\/$/, '');
  if (
    url.origin !== api.origin ||
    !(url.pathname === apiPath || url.pathname.startsWith(`${apiPath}/`))
  )
    return next(request);
  const session = inject(Session);
  const router = inject(Router);
  const revision = session.revision;
  let headers = request.headers.delete('Authorization');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    headers = headers.set('X-CSRF-Protection', '1');
  }
  return next(request.clone({ withCredentials: true, headers })).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        !url.pathname.startsWith(`${apiPath}/auth/`) &&
        session.revision === revision
      ) {
        if (error.status === 401) {
          session.invalidate();
          void router.navigate(['/login'], {
            queryParams: { reason: 'expired', returnUrl: router.url },
            replaceUrl: true,
          });
        } else if (error.status === 403 && session.user()) {
          // Permissions may change while the session cookie remains valid.
          void session.isAuthenticated(true).then((valid) => {
            if (!valid && !session.user()) void router.navigate(['/login'], { replaceUrl: true });
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
