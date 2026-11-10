import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Session } from '../../../core/auth/session';
import { Sidebar } from './sidebar';
import { HealthList } from '../../../features/health/presentation/health-list';
import { HealthRepository } from '../../../features/health/infrastructure/health-repository';
// Reference matrix: generated from the backend's tests/fixtures/profile_matrix.json.
// This is test data, not a replacement for permissions configured by the ranch owner.
const profiles: Record<string, string[]> = {
  owner: [
    'animals:read',
    'animals:write',
    'audit:read',
    'breeding:read',
    'breeding:write',
    'exits:read',
    'exits:write',
    'feeding:read',
    'feeding:write',
    'finance:read',
    'finance:write',
    'groups:read',
    'groups:write',
    'health:cases:write',
    'health:diagnoses:create',
    'health:doses:create',
    'health:followups:create',
    'health:incidents:write',
    'health:observations:create',
    'health:products:write',
    'health:program_applications:create',
    'health:programs:write',
    'health:reactions:write',
    'health:read',
    'health:treatments:create',
    'history:rectify',
    'locations:read',
    'locations:write',
    'roles:read',
    'roles:write',
    'users:read',
    'users:write',
    'weights:read',
    'weights:write',
  ],
  administrator: [
    'animals:read',
    'animals:write',
    'audit:read',
    'breeding:read',
    'breeding:write',
    'exits:read',
    'exits:write',
    'feeding:read',
    'feeding:write',
    'finance:read',
    'finance:write',
    'groups:read',
    'groups:write',
    'health:cases:write',
    'health:diagnoses:create',
    'health:doses:create',
    'health:followups:create',
    'health:incidents:write',
    'health:observations:create',
    'health:products:write',
    'health:program_applications:create',
    'health:programs:write',
    'health:reactions:write',
    'health:read',
    'health:treatments:create',
    'locations:read',
    'locations:write',
    'roles:read',
    'roles:write',
    'users:read',
    'users:write',
    'weights:read',
    'weights:write',
  ],
  manager: [
    'animals:read',
    'animals:write',
    'breeding:read',
    'breeding:write',
    'exits:read',
    'exits:write',
    'feeding:read',
    'feeding:write',
    'finance:read',
    'finance:write',
    'groups:read',
    'groups:write',
    'health:cases:write',
    'health:followups:create',
    'health:incidents:write',
    'health:observations:create',
    'health:read',
    'locations:read',
    'locations:write',
    'weights:read',
    'weights:write',
  ],
  worker: [
    'animals:read',
    'feeding:read',
    'feeding:write',
    'groups:read',
    'health:doses:create',
    'health:incidents:write',
    'health:observations:create',
    'health:read',
    'locations:read',
    'weights:read',
    'weights:write',
  ],
  veterinarian: [
    'animals:read',
    'feeding:read',
    'health:cases:write',
    'health:diagnoses:create',
    'health:doses:create',
    'health:followups:create',
    'health:incidents:write',
    'health:observations:create',
    'health:products:write',
    'health:program_applications:create',
    'health:programs:write',
    'health:reactions:write',
    'health:read',
    'health:treatments:create',
    'weights:read',
  ],
  livestock_technician: [
    'animals:read',
    'breeding:read',
    'breeding:write',
    'feeding:read',
    'groups:read',
    'health:doses:create',
    'health:followups:create',
    'health:observations:create',
    'health:program_applications:create',
    'health:read',
    'locations:read',
    'weights:read',
    'weights:write',
  ],
};
const allRoutes = [
  'overview',
  'animals',
  'genealogy',
  'breeds',
  'health',
  'breeding',
  'management',
  'exits',
  'feeding',
  'finance',
  'reports',
  'locations',
  'groups',
  'users',
  'audit',
  'roles',
];
const routes: Record<string, string[]> = {
  owner: allRoutes,
  administrator: allRoutes,
  manager: allRoutes.filter((r) => !['users', 'audit', 'roles'].includes(r)),
  worker: [
    'overview',
    'animals',
    'genealogy',
    'breeds',
    'health',
    'management',
    'feeding',
    'reports',
    'locations',
    'groups',
  ],
  veterinarian: [
    'overview',
    'animals',
    'genealogy',
    'breeds',
    'health',
    'management',
    'feeding',
    'reports',
  ],
  livestock_technician: [
    'overview',
    'animals',
    'genealogy',
    'breeds',
    'health',
    'breeding',
    'management',
    'feeding',
    'reports',
    'locations',
    'groups',
  ],
};
const actions: Record<
  string,
  {
    observation: boolean;
    cases: boolean;
    diagnoses: boolean;
    treatments: boolean;
    doses: boolean;
    followups: boolean;
  }
> = {
  owner: {
    observation: true,
    cases: true,
    diagnoses: true,
    treatments: true,
    doses: true,
    followups: true,
  },
  administrator: {
    observation: true,
    cases: true,
    diagnoses: true,
    treatments: true,
    doses: true,
    followups: true,
  },
  manager: {
    observation: true,
    cases: true,
    diagnoses: false,
    treatments: false,
    doses: false,
    followups: true,
  },
  worker: {
    observation: true,
    cases: false,
    diagnoses: false,
    treatments: false,
    doses: true,
    followups: false,
  },
  veterinarian: {
    observation: true,
    cases: true,
    diagnoses: true,
    treatments: true,
    doses: true,
    followups: true,
  },
  livestock_technician: {
    observation: true,
    cases: false,
    diagnoses: false,
    treatments: false,
    doses: true,
    followups: true,
  },
};
describe('Six operational profiles', () => {
  for (const name of Object.keys(profiles)) {
    it('renders only authorized navigation for ' + name, () => {
      TestBed.configureTestingModule({
        imports: [Sidebar],
        providers: [
          provideRouter([]),
          { provide: Session, useValue: { user: signal({ permissions: profiles[name] }) } },
        ],
      });
      const f = TestBed.createComponent(Sidebar);
      f.detectChanges();
      const paths = Array.from(f.nativeElement.querySelectorAll('nav a')).map((a: any) =>
        a.getAttribute('href').split('/').at(-1),
      );
      expect(paths.sort()).toEqual([...routes[name]].sort());
    });
    it('renders sanitary actions and blocks internal form entry for ' + name, async () => {
      const empty = { items: [], total: 0, offset: 0, limit: 25 };
      TestBed.configureTestingModule({
        imports: [HealthList],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Session, useValue: { user: signal({ permissions: profiles[name] }) } },
          {
            provide: HealthRepository,
            useValue: {
              cases: async () => empty,
              observations: async () => empty,
              detail: async () => ({
                case: {
                  id: 'case1',
                  animal: { id: 'a1', name: 'Prueba', siniiga: null },
                  status: 'open',
                  start_date: '2024-01-01',
                  closed_date: null,
                  notes: null,
                  reason: 'SIMULACIÓN',
                },
                observations: [],
                diagnoses: [],
                treatments: [],
                activity: [],
                followups: [],
              }),
            },
          },
        ],
      });
      const f = TestBed.createComponent(HealthList);
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      const expected = actions[name],
        c = f.componentInstance as any;
      expect(!!f.nativeElement.querySelector('[data-testid=new-observation]')).toBe(
        expected.observation,
      );
      expect(!!f.nativeElement.querySelector('[data-testid=new-case]')).toBe(expected.cases);
      await c.openDetail('case1');
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http
        .match((r) => r.url.endsWith('/health/reactions') || r.url.endsWith('/health/incidents'))
        .forEach((r) => r.flush(empty));
      expect(!!f.nativeElement.querySelector('[data-testid=new-diagnosis]')).toBe(
        expected.diagnoses,
      );
      expect(!!f.nativeElement.querySelector('[data-testid=new-treatment]')).toBe(
        expected.treatments,
      );
      expect(!!f.nativeElement.querySelector('[data-testid=new-followup]')).toBe(
        expected.followups,
      );
      expect(c.canDose()).toBe(expected.doses);
      if (!expected.diagnoses) {
        c.openDiagnosis();
        expect(c.diagnosisOpen()).toBe(false);
      }
      if (!expected.treatments) {
        await c.openTreatment();
        expect(c.treatmentOpen()).toBe(false);
      }
      if (!expected.cases) {
        c.openForm('case');
        expect(c.formKind()).toBeNull();
      }
      http.verify();
      f.destroy();
    });
  }
  it('updates navigation when the session changes and removes links after logout', () => {
    const user = signal<any>({ permissions: profiles['owner'] });
    TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([]), { provide: Session, useValue: { user } }],
    });
    const f = TestBed.createComponent(Sidebar);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Economía');
    user.set({ permissions: profiles['worker'] });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Economía');
    expect(f.nativeElement.textContent).not.toContain('Roles y permisos');
    user.set(null);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('nav a').length).toBe(1);
  });
});
