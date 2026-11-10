import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProfitAnimalSelect } from './profit-animal-select';
describe('Searchable animal selector', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({imports:[ProfitAnimalSelect], providers:[provideHttpClient(),provideHttpClientTesting()]}); http=TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('loads on focus and selects an exact animal using the keyboard', async () => {
    const f=TestBed.createComponent(ProfitAnimalSelect); f.detectChanges();
    const selected: unknown[]=[]; f.componentInstance.selectedChange.subscribe(a=>selected.push(a));
    const input=f.nativeElement.querySelector('input'); input.dispatchEvent(new Event('focus'));
    http.expectOne(r=>r.url.endsWith('/allocation-options') && r.params.get('kind')==='animal').flush([{id:'one',name:'Luna',siniiga:'MX1'},{id:'two',name:'Luna',siniiga:'MX2'}]);
    await expect.poll(()=>{f.detectChanges(); return f.nativeElement.querySelectorAll('[role="option"]').length;}).toBe(3);
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'})); f.detectChanges();
    expect(selected).toEqual([{id:'one',name:'Luna',siniiga:'MX1'}]);
    expect(input.value).toContain('MX1'); expect(input.getAttribute('aria-expanded')).toBe('false');
    f.nativeElement.querySelector('button[aria-label="Limpiar selección de animal"]').click(); f.detectChanges();
    expect(selected.at(-1)).toBeNull(); expect(input.value).toBe('');
  });
  it('filters as typed and announces no matches', async () => {
    const f=TestBed.createComponent(ProfitAnimalSelect);f.detectChanges();
    const input=f.nativeElement.querySelector('input');input.value='inexistente';input.dispatchEvent(new Event('input'));
    let stale: any;
    await expect.poll(()=>{ const rs=http.match(r=>r.params.get('q')==='inexistente');if(rs.length)stale=rs[0];return !!stale; }).toBe(true);
    // A new query replaces the previous one; late responses must not replace its choices.
    input.value='Aurora';input.dispatchEvent(new Event('input'));
    let req: any;
    await expect.poll(()=>{const rs=http.match(r=>r.params.get('q')==='Aurora');if(rs.length)req=rs[0];return !!req;}).toBe(true);
    req.flush([]); stale.flush([{id:'old',name:'Old result',siniiga:null}]);
    await expect.poll(()=>{f.detectChanges();return f.nativeElement.textContent;}).toContain('No hay animales que coincidan');
    f.destroy();
  });
});
