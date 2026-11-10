import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { AuditList } from './audit-list';
import { changeValue, formatValue } from '../domain/audit';
import { navigationFor } from '../../../shared/ui/sidebar/navigation';
const ACTOR = { id: 'u1', name: 'Cristopher Ozuna', email: 'owner@example.com', active: true };
const ROW = {
  id: 'a1',
  date: '2024-06-01T06:00:00Z',
  actor: ACTOR,
  module: 'users',
  table: 'users',
  record_id: 'u2',
  record_name: 'Ana',
  event_type_id: null,
  action: 'UPDATE',
};
const PAGE = { items: [ROW], total: 1, offset: 0, limit: 25 };
const DETAIL = {
  ...ROW,
  old_values: { name: 'Ana', role_id: 'r1' },
  new_values: { name: 'Anabel', role_id: 'r2' },
  changes: [
    { field: 'name', before_present: true, after_present: true, before: 'Ana', after: 'Anabel' },
    {
      field: 'role_id',
      before_present: true,
      after_present: true,
      before: 'r1',
      after: 'r2',
      before_label: 'worker',
      after_label: 'manager',
    },
    { field: 'middle_name', before_present: false, after_present: true, before: null, after: null },
  ],
};
describe('Audit history', () => {
  let permissions: string[];
  let http: HttpTestingController;
  beforeEach(async () => {
    permissions = ['audit:read'];
    await TestBed.configureTestingModule({
      imports: [AuditList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture() {
    const f = TestBed.createComponent(AuditList);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/audit')).flush(PAGE);
    http.expectOne((r) => r.url.endsWith('/audit/users')).flush([ACTOR]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Ana');
    return f;
  }
  function fill(f: ComponentFixture<AuditList>, id: string, value: string) {
    const e = f.nativeElement.querySelector('#' + id);
    e.value = value;
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    f.detectChanges();
  }
  function submit(f: ComponentFixture<AuditList>) {
    f.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.detectChanges();
  }
  it('requires the dedicated permission for both the page and navigation', () => {
    permissions = ['users:read', 'roles:read'];
    const f = TestBed.createComponent(AuditList);
    f.detectChanges();
    http.expectNone((r) => r.url.includes('/audit'));
    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    expect(navigationFor(permissions).some((n) => n.path === 'audit')).toBe(false);
    expect(navigationFor(['audit:read']).some((n) => n.path === 'audit')).toBe(true);
  });
  it('applies inclusive local dates, module, user and action together', async () => {
    const f = await fixture();
    fill(f, 'audit-module', 'users');
    fill(f, 'audit-action', 'UPDATE');
    fill(f, 'audit-user', 'u1');
    fill(f, 'audit-from', '2024-06-01');
    fill(f, 'audit-to', '2024-06-01');
    submit(f);
    const req = http.expectOne((r) => r.url.endsWith('/audit'));
    expect(req.request.params.get('module')).toBe('users');
    expect(req.request.params.get('action')).toBe('UPDATE');
    expect(req.request.params.get('user_id')).toBe('u1');
    expect(req.request.params.get('date_from')).toBe(new Date(2024, 5, 1).toISOString());
    expect(req.request.params.get('date_before')).toBe(new Date(2024, 5, 2).toISOString());
    req.flush(PAGE);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Ana');
    fill(f, 'audit-from', '2024-06-02');
    submit(f);
    http.expectNone((r) => r.url.endsWith('/audit'));
    expect(f.nativeElement.textContent).toContain('La fecha inicial');
  });
  it('shows changes with resolved roles and distinguishes absent fields from null', async () => {
    const f = await fixture();
    f.nativeElement.querySelector('[data-audit-row] button').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/audit/a1')).flush(DETAIL);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('Anabel');
    const content = f.nativeElement.querySelector('dialog').textContent;
    expect(content).toContain('Trabajador');
    expect(content).toContain('Encargado');
    expect(content).toContain('No existía');
    expect(content).toContain('Sin valor');
    expect(f.nativeElement.querySelector('dialog [data-audit-change]').textContent).toContain(
      'Antes',
    );
    [...f.nativeElement.querySelectorAll('dialog button')]
      .find((b: any) => b.textContent.includes('Ver historial'))
      .click();
    f.detectChanges();
    const req = http.expectOne((r) => r.url.endsWith('/audit'));
    expect(req.request.params.get('record_id')).toBe('u2');
    expect(req.request.params.get('table')).toBe('users');
    req.flush(PAGE);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Historial de: Usuario · Ana');
  });
  it('ignores late detail responses after closing and exposes consultation failures', async () => {
    const f = await fixture();
    f.nativeElement.querySelector('[data-audit-row] button').click();
    f.detectChanges();
    const req = http.expectOne((r) => r.url.endsWith('/audit/a1'));
    f.nativeElement.querySelector('button[aria-label="Cerrar diálogo"]').click();
    f.detectChanges();
    req.flush(DETAIL);
    await Promise.resolve();
    f.detectChanges();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
    f.nativeElement.querySelector('[data-audit-row] button').click();
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/audit/a1'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('dialog')?.textContent;
      })
      .toContain('El servicio no está disponible');
  });
  it('keeps the selected actor when looking for inactive users', async () => {
    const f = await fixture();
    fill(f, 'audit-user', 'u1');
    const e = f.nativeElement.querySelector('input[aria-label="Buscar usuario del historial"]');
    e.value = 'inactivo';
    e.dispatchEvent(new Event('input', { bubbles: true }));
    f.nativeElement.querySelector('details button').click();
    http
      .expectOne((r) => r.url.endsWith('/audit/users') && r.params.get('q') === 'inactivo')
      .flush([{ ...ACTOR, id: 'u3', name: 'Otro', active: false }]);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.querySelector('#audit-user').textContent;
      })
      .toContain('Inactivo');
    expect(f.nativeElement.querySelector('#audit-user').value).toBe('u1');
  });
  it('renders permission changes without raw codes and preserves free text', () => {
    expect(formatValue(['health:read', 'audit:read'], 'permissions')).toContain(
      'Consultar auditoría',
    );
    expect(formatValue('open', 'reason')).toBe('open');
    expect(
      changeValue(
        { field: 'active', before_present: true, after_present: true, before: true, after: false },
        'after',
      ),
    ).toBe('No');
  });
});
