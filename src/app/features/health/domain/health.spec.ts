import { lastTreatmentDay } from './health';
describe('Treatment dates', () => {
  it('includes the start day and handles month changes and leap years', () => {
    expect(lastTreatmentDay('2024-01-01', 1)).toBe('2024-01-01');
    expect(lastTreatmentDay('2024-02-28', 3)).toBe('2024-03-01');
  });
  it('ignores missing or invalid durations', () => {
    expect(lastTreatmentDay('', 3)).toBeNull();
    expect(lastTreatmentDay('2024-01-01', 0)).toBeNull();
    expect(lastTreatmentDay('2024-01-01', 1.5)).toBeNull();
  });
});
