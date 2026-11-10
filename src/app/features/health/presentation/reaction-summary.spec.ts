import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { ReactionSummary } from './reaction-summary';
describe('Visible animal reaction history', () => {
  let permissions: string[];
  beforeEach(async () => {
    permissions = ['health:read'];
    await TestBed.configureTestingModule({
      imports: [ReactionSummary],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Session, useValue: { user: () => ({ permissions }) } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('does not request or display clinical data without read permission', () => {
    permissions = [];
    const f = TestBed.createComponent(ReactionSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/health/'));
    expect(f.nativeElement.textContent.trim()).toBe('');
  });
  it('keeps closed reports visible and offers filtered full history', async () => {
    const f = TestBed.createComponent(ReactionSummary);
    f.componentRef.setInput('animalId', 'a1');
    f.detectChanges();
    const h = TestBed.inject(HttpTestingController);
    const req = h.expectOne((r) => r.url.endsWith('/health/reactions'));
    expect(req.request.params.get('animal_id')).toBe('a1');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({
      items: [
        {
          id: 'r1',
          date: '2024-01-05',
          kind: 'suspected_allergy',
          product_name: 'Producto registrado',
          description: 'Antecedente que se conserva.',
          status: 'closed',
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
      .toContain('Seguimiento cerrado');
    expect(f.nativeElement.textContent).toContain('Antecedente que se conserva');
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toContain('animal_id=a1');
  });
});
