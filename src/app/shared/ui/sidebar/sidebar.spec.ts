import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { Sidebar } from './sidebar';

@Component({ template: '' })
class EmptyPage {}

function setup(
  permissions = ['animals:read', 'weights:read', 'health:read', 'finance:read', 'users:read'],
) {
  const user = signal<any>({ permissions });
  TestBed.configureTestingModule({
    imports: [Sidebar],
    providers: [
      provideRouter([{ path: '**', component: EmptyPage }]),
      { provide: Session, useValue: { user } },
    ],
  });
  const fixture = TestBed.createComponent(Sidebar);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const group = (id: string) =>
    element.querySelector<HTMLButtonElement>(`[data-nav-group="${id}"]`)!;
  return { fixture, element, group, user, router: TestBed.inject(Router) };
}

describe('Sidebar submenus', () => {
  it('toggles one section at a time without navigating or closing the mobile menu', () => {
    const { fixture, group, element } = setup();
    const navigated = vi.fn();
    fixture.componentInstance.navigate.subscribe(navigated);
    expect(group('herd').getAttribute('aria-expanded')).toBe('false');
    group('herd').click();
    fixture.detectChanges();
    expect(group('herd').getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector<HTMLElement>('#sidebar-herd')!.hidden).toBe(false);
    group('operations').click();
    fixture.detectChanges();
    expect(element.querySelector<HTMLElement>('#sidebar-herd')!.hidden).toBe(true);
    expect(group('operations').getAttribute('aria-expanded')).toBe('true');
    group('operations').click();
    fixture.detectChanges();
    expect(group('operations').getAttribute('aria-expanded')).toBe('false');
    expect(navigated).not.toHaveBeenCalled();
  });

  it('opens the current section on deep links and marks the right leaf active', async () => {
    const { fixture, router, group, element } = setup();
    await router.navigateByUrl('/dashboard/health/products?search=medicine');
    fixture.detectChanges();
    expect(group('operations').getAttribute('aria-expanded')).toBe('true');
    const link = element.querySelector<HTMLAnchorElement>('a[href="/dashboard/health"]')!;
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(element.querySelectorAll('[aria-current="page"]').length).toBe(1);
    group('operations').click();
    fixture.detectChanges();
    expect(group('operations').getAttribute('aria-expanded')).toBe('false');
    await router.navigateByUrl('/dashboard/animals');
    fixture.detectChanges();
    expect(group('herd').getAttribute('aria-expanded')).toBe('true');
  });

  it('removes empty groups and unauthorized links when permissions change', () => {
    const { fixture, element, user, group } = setup(['animals:read']);
    expect(group('herd')).toBeTruthy();
    expect(group('administration')).toBeNull();
    expect(group('economy')).toBeNull();
    expect(element.querySelector('a[href="/dashboard/users"]')).toBeNull();
    user.set({ permissions: ['finance:read'] });
    fixture.detectChanges();
    expect(group('herd')).toBeNull();
    expect(group('economy')).toBeTruthy();
    user.set(null);
    fixture.detectChanges();
    expect(element.querySelectorAll('nav button').length).toBe(0);
    expect(element.querySelectorAll('nav a').length).toBe(1);
  });

  it('emits navigation only when selecting a destination', async () => {
    const { fixture, group, element } = setup();
    const navigated = vi.fn();
    fixture.componentInstance.navigate.subscribe(navigated);
    group('herd').click();
    fixture.detectChanges();
    element.querySelector<HTMLAnchorElement>('a[href="/dashboard/animals"]')!.click();
    await fixture.whenStable();
    expect(navigated).toHaveBeenCalledTimes(1);
  });
});
