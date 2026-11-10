import { ChartModel } from '../../../shared/ui/chart/chart';
import { dayNumber, Weight } from '../domain/weights';
export function weightChartModel(items: Weight[]): ChartModel {
  const labels = items.map((item) =>
    new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(item.date + 'T00:00:00Z')),
  );
  return {
    type: 'line',
    unit: 'kg',
    labels,
    series: [{ label: 'Peso', values: items.map((item) => Number(item.weight_kg)) }],
    days: items.map((item) => dayNumber(item.date)),
    annotations: items.map((item) => (item.is_weaning ? 'Pesaje de destete' : '')),
  };
}
