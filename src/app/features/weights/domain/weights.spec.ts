import { measurements, plot, Weight } from './weights';
const animal = { id: 'a', name: 'Luna', siniiga: null };
function weight(id: string, date: string, kg: string): Weight {
  return { id, date, weight_kg: kg, animal, notes: null, recorded_by: 'Cris' };
}
describe('Weight evolution', () => {
  it('calculates gains over actual calendar intervals including losses', () => {
    const rows = measurements([
      weight('1', '2024-02-28', '30'),
      weight('2', '2024-03-01', '31'),
      weight('3', '2024-03-03', '29'),
    ]);
    expect(rows[0].gain).toBeNull();
    expect(rows[1].days).toBe(2);
    expect(rows[1].daily).toBe(0.5);
    expect(rows[2].gain).toBe(-2);
    expect(rows[2].daily).toBe(-1);
  });
  it('does not divide by zero and plots single or constant measurements safely', () => {
    expect(
      measurements([weight('1', '2024-01-01', '30'), weight('2', '2024-01-01', '31')])[1].daily,
    ).toBeNull();
    expect(plot([])).toBeNull();
    const single = plot([weight('1', '2024-01-01', '30')])!;
    expect(single.points[0].x).toBe(370);
    expect(Number.isFinite(single.points[0].y)).toBe(true);
    const chart = plot([
      weight('1', '2024-01-01', '30'),
      weight('2', '2024-01-02', '30'),
      weight('3', '2024-01-11', '30'),
    ])!;
    expect(chart.points[1].x - chart.points[0].x).toBeCloseTo(
      (chart.points[2].x - chart.points[0].x) / 10,
    );
  });
});
