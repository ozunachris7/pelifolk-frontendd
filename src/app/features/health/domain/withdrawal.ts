export type WithdrawalStatus = 'pending' | 'complete' | 'unknown' | 'no_records';
export interface Withdrawal {
  animal: { id: string; name: string | null; siniiga: string | null };
  as_of: string;
  status: WithdrawalStatus;
  release_date: string | null;
  treatment_count: number;
  application_count?: number;
  missing_applications_count?: number;
  unknown_count: number;
  in_treatment: boolean;
  items?: {
    event_id: string;
    product_id?: string;
    estimated_release_date?: string | null;
    planned_release_date?: string | null;
    last_applied_at?: string | null;
    application_count?: number;
    calculation_basis?: 'applications' | 'planned';
    review_reasons?: string[];
    is_replaced?: boolean;
    product_name: string;
    start_date: string;
    last_day: string;
    withdrawal_days: number | null;
    release_date: string | null;
    status: WithdrawalStatus;
    in_treatment: boolean;
  }[];
}
export const withdrawalLabel = (status: WithdrawalStatus) =>
  ({
    pending: 'Retiro pendiente',
    complete: 'Sin retiro pendiente según registros',
    unknown: 'Periodo por verificar',
    no_records: 'Sin tratamientos registrados',
  })[status];

export const withdrawalReviewReason = (reason: string) =>
  (
    ({
      missing_applications: 'Sin dosis aplicadas registradas.',
      missing_withdrawal_days: 'El tratamiento no conserva sus días de retiro.',
      invalid_withdrawal_days: 'El periodo guardado no es válido y requiere revisión.',
      dose_variation: 'Hay aplicaciones que difieren de la pauta; el periodo requiere revisión.',
      replaced_treatment:
        'La pauta fue reemplazada y conserva aplicaciones reales; requiere revisión.',
      date_overflow: 'El periodo guardado excede las fechas admitidas.',
    }) as Record<string, string>
  )[reason] ?? 'Registro por verificar.';

export function withdrawalApplicationLabel(value: string) {
  const suffix = value.slice(19) === 'Z' ? '+00:00' : value.slice(19);
  return `${value.slice(0, 10).split('-').reverse().join('/')} ${value.slice(11, 16)} (UTC${suffix})`;
}
