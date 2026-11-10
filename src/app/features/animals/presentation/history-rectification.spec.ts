import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Session } from '../../../core/auth/session';
import { HistoryRectification } from './history-rectification';
const source = {
  title: 'Pesaje',
  date: '2024-01-01',
  notes: null,
  recorded_by: 'Owner',
  details: [{ label: 'Peso (kg)', value: '25.00' }],
};
const context = {
  source,
  snapshot_token: 'a'.repeat(64),
  version: 0,
  can_rectify: true,
  replacement_mode: 'weight',
  initial: { animal_id: 'a1', date: '2024-01-01', weight_kg: '25.00', notes: null },
  explanation: null,
  entries: [],
};
describe('Historical rectification', () => {
  let http: HttpTestingController;
  let permissions: string[];
  beforeEach(() => {
    permissions = ['animals:read', 'weights:read', 'weights:write', 'history:rectify'];
    TestBed.configureTestingModule({
      imports: [HistoryRectification],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function fixture(c: any = context, has = false) {
    const f = TestBed.createComponent(HistoryRectification);
    f.componentRef.setInput('animalId', 'a1');
    f.componentRef.setInput('entryId', 'event:w1:2024-01-01 00:00:00');
    f.componentRef.setInput('hasRectifications', has);
    f.detectChanges();
    f.nativeElement.querySelector('button').click();
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/a1/rectifications')).flush(c);
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Rectificación del historial');
    return f;
  }
  it('sends only corrected fields with the original version and token', async () => {
    const f = await fixture();
    const c = f.componentInstance as any;
    c.form.patchValue({
      mode: 'weight',
      weight_kg: '26.50',
      reason: 'Se verificó una captura equivocada.',
    });
    const saved = vi.fn();
    f.componentInstance.saved.subscribe(saved);
    const p = c.save();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body.expected_version).toBe(0);
    expect(req.request.body.snapshot_token).toBe(context.snapshot_token);
    expect(req.request.body.weight.weight_kg).toBe('26.50');
    expect(req.request.body.weight.animal_id).toBe('a1');
    expect(req.request.body.clarification).toBeUndefined();
    req.flush({ id: 'r1' });
    await p;
    expect(saved).toHaveBeenCalledOnce();
  });
  it('requires a meaningful reason and clarification', async () => {
    const f = await fixture();
    const c = f.componentInstance as any;
    c.form.patchValue({ reason: 'error', clarification: 'nota' });
    await c.save();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('al menos 10 caracteres');
    http.expectNone((r) => r.method === 'POST');
  });
  it('keeps the form after a stale-version rejection', async () => {
    const f = await fixture();
    const c = f.componentInstance as any;
    c.form.patchValue({
      reason: 'Se verificó el documento original.',
      clarification: 'La aclaración que no debe perderse.',
    });
    const p = c.save();
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'History changed; reload the rectification before saving' },
        { status: 409, statusText: 'Conflict' },
      );
    await p;
    f.detectChanges();
    expect(c.form.controls.clarification.value).toContain('no debe perderse');
    expect(f.nativeElement.textContent).toContain('Recarga la rectificación');
  });
  it('lets readers consult preserved originals without an edit form', async () => {
    permissions = ['animals:read', 'weights:read'];
    const f = await fixture(
      {
        ...context,
        can_rectify: false,
        replacement_mode: null,
        initial: null,
        entries: [
          {
            id: 'r1',
            version: 1,
            mode: 'weight',
            reason: 'Corrección documentada.',
            clarification: null,
            original: source,
            corrected: { weight_kg: '26.50' },
            recorded_by: 'Owner',
            created_at: '2026-10-17T01:00:00Z',
          },
        ],
      },
      true,
    );
    expect(f.nativeElement.textContent).toContain('25.00');
    expect(f.nativeElement.textContent).toContain('26.50');
    expect(f.nativeElement.querySelector('form')).toBeNull();
  });
});
