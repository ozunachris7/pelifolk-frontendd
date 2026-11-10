import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RoleList } from './role-list';
import { Session } from '../../../../../core/auth/session';
import { ManageAccess } from '../../../application/manage-access';
describe('Sanitary action assignment', () => {
  function component(permissions: string[]) {
    TestBed.configureTestingModule({
      imports: [RoleList],
      providers: [provideRouter([]),
        { provide: Session, useValue: { user: signal({ permissions }) } },
        { provide: ManageAccess, useValue: {} },
      ],
    });
    return TestBed.createComponent(RoleList).componentInstance as any;
  }
  function change(c: any, p: string, checked: boolean) {
    c.togglePermission(p, { target: { checked } } as any);
  }
  it('adds read access when assigning an action and clears all actions when removing read', () => {
    const c = component([
      'roles:write',
      'health:read',
      'health:observations:create',
      'health:doses:create',
    ]);
    change(c, 'health:observations:create', true);
    change(c, 'health:doses:create', true);
    expect(c.selectedPermissions()).toEqual([
      'health:read',
      'health:observations:create',
      'health:doses:create',
    ]);
    change(c, 'health:read', false);
    expect(c.selectedPermissions()).toEqual([]);
  });
  it('does not grant actions the administrator does not own', () => {
    const c = component(['roles:write', 'health:read', 'health:observations:create']);
    change(c, 'health:treatments:create', true);
    expect(c.selectedPermissions()).toEqual([]);
  });
  it('can remove an action while retaining sanitary consultation', () => {
    const c = component(['roles:write', 'health:read', 'health:observations:create']);
    change(c, 'health:observations:create', true);
    change(c, 'health:observations:create', false);
    expect(c.selectedPermissions()).toEqual(['health:read']);
  });
});
