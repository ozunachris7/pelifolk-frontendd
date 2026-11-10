import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { AssessmentSummary } from './assessment-summary';
describe('Maternal and offspring evaluations in animal detail', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['breeding:read'];
    await TestBed.configureTestingModule({
      imports: [AssessmentSummary],
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
    const f = TestBed.createComponent(AssessmentSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    h.expectNone((r) => r.url.includes('/breeding/assessments'));
    f.nativeElement.querySelector('[data-toggle-assessments]').click();
    f.detectChanges();
    const req = h.expectOne((r) => r.url.endsWith('/breeding/assessments'));
    expect(req.request.params.get('animal_id')).toBe('a1');
    req.flush({
      items: [
        {
          id: 'e1',
          kind: 'offspring',
          animal: { id: 'c1', name: 'Estrella', siniiga: null },
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
    const f = TestBed.createComponent(AssessmentSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) =>
      r.url.includes('/breeding/assessments'),
    );
    expect(f.nativeElement.textContent.trim()).toBe('');
  });
});
