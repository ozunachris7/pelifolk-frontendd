import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { PhysicalSummary } from './physical-summary';
describe('Physical evaluations in animal detail', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['animals:read'];
    await TestBed.configureTestingModule({
      imports: [PhysicalSummary],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('does not request data until the history is opened', async () => {
    const f = TestBed.createComponent(PhysicalSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectNone((r) => r.url.includes('/physical-evaluations'));
    f.nativeElement.querySelector('[data-toggle-physical]').click();
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/physical-evaluations'));
    expect(req.request.params.get('animal_id')).toBe('a1');
    req.flush({
      items: [
        {
          id: 'e1',
          date: '2024-01-04',
          evaluated_by: 'Responsable',
          recorded_by: 'Capturista',
          findings: [
            { code: 'movement', label: 'Desplazamiento', observation: 'Descripción original.' },
          ],
        },
      ],
      total: 1,
      offset: 0,
      limit: 5,
    });
    await expect
      .poll(() => {
        f.detectChanges();
        return f.nativeElement.textContent;
      })
      .toContain('Descripción original.');
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toContain('animal_id=a1');
  });
  it('hides physical observations without animal access', () => {
    permissions = [];
    const f = TestBed.createComponent(PhysicalSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) =>
      r.url.includes('/physical-evaluations'),
    );
    expect(f.nativeElement.textContent.trim()).toBe('');
  });
});
