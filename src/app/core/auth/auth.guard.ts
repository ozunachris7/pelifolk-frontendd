import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session);
  const router = inject(Router);
  return (
    (await session.isAuthenticated()) ||
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};

export const authChildGuard: CanActivateChildFn = authGuard;

export const guestGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  return !(await session.isAuthenticated()) || router.createUrlTree(['/dashboard/overview']);
};
