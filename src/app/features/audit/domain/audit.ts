import { permissionLabel, roleLabel } from '../../users/presentation/access-labels';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';
export interface AuditActor {
  id: string;
  name: string;
  email: string;
  active: boolean;
}
export interface AuditRecord {
  id: string;
  date: string;
  actor: AuditActor | null;
  module: string;
  table: string;
  record_id: string;
  record_name: string | null;
  event_type_id: number | null;
  action: AuditAction;
}
export interface AuditPage {
  items: AuditRecord[];
  total: number;
  offset: number;
  limit: number;
}
export interface AuditChange {
  field: string;
  before_present: boolean;
  after_present: boolean;
  before: unknown;
  after: unknown;
  before_label?: string | null;
  after_label?: string | null;
}
export interface AuditDetail extends AuditRecord {
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changes: AuditChange[];
}
export interface AuditFilters {
  q: string;
  module: string;
  action: AuditAction | '';
  user_id: string;
  date_from: string;
  date_to: string;
  record_id: string;
  table: string;
}
export const auditModules = [
  ['animals', 'Animales y razas'],
  ['health', 'Sanidad'],
  ['breeding', 'Reproducción'],
  ['weights', 'Pesajes'],
  ['exits', 'Salidas'],
  ['finance', 'Economía'],
  ['feeding', 'Alimentación'],
  ['locations', 'Ubicaciones'],
  ['groups', 'Lotes'],
  ['users', 'Usuarios'],
  ['roles', 'Roles y permisos'],
  ['other', 'Otros registros'],
] as const;
export const actionLabel = (action: AuditAction) =>
  ({ INSERT: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación' })[action];
export const moduleLabel = (module: string) =>
  auditModules.find(([code]) => code === module)?.[1] ?? 'Otros registros';
const entities: Record<string, string> = {
  animals: 'Animal',
  event_weanings: 'Destete',
  animal_decisions: 'Decisión del animal',
  breeds: 'Raza',
  users: 'Usuario',
  roles: 'Rol',
  health_cases: 'Caso sanitario',
  treatment_doses: 'Dosis aplicada',
  health_case_observations: 'Vínculo de observación con caso',
  history_rectifications: 'Rectificación del historial',
  health_case_followups: 'Seguimiento sanitario',
  products: 'Producto',
  health_programs: 'Programa sanitario',
  locations: 'Ubicación',
  location_types: 'Tipo de ubicación',
  groups: 'Lote',
  animal_groups: 'Lote',
  group_animals: 'Pertenencia al lote',
  expenses: 'Gasto',
  incomes: 'Ingreso',
  suppliers: 'Proveedor',
  expense_categories: 'Categoría de gasto',
  income_categories: 'Categoría de ingreso',
  expense_allocations: 'Distribución de gasto',
  feeds: 'Alimento',
  feed_prices: 'Precio de alimento',
  feedings: 'Consumo de alimento',
  product_prices: 'Precio de producto',
};
const events: Record<number, string> = {
  1: 'Observación',
  2: 'Diagnóstico',
  3: 'Tratamiento',
  4: 'Pesaje',
  5: 'Monta',
  6: 'Diagnóstico de gestación',
  7: 'Parto',
  8: 'Salida',
  9: 'Traslado',
};
export const entityLabel = (row: AuditRecord) =>
  row.table === 'events'
    ? (events[row.event_type_id ?? 0] ?? 'Evento')
    : (entities[row.table] ?? row.table.replaceAll('_', ' '));
const fields: Record<string, string> = {
  id: 'Identificador',
  name: 'Nombre',
  middle_name: 'Segundo nombre',
  paternal_lastname: 'Apellido paterno',
  maternal_lastname: 'Apellido materno',
  email: 'Correo',
  phone: 'Teléfono',
  role_id: 'Rol',
  permissions: 'Permisos',
  active: 'Activo',
  password_changed: 'Contraseña actualizada',
  siniiga: 'SINIIGA',
  sex: 'Sexo',
  birth_date: 'Fecha de nacimiento',
  origin: 'Origen',
  mother_id: 'Madre',
  father_id: 'Padre',
  is_breeder: 'Reproductor',
  breeds: 'Razas',
  breed_id: 'Raza',
  percentage: 'Porcentaje',
  purebred: 'Pureza',
  animal_id: 'Animal',
  event_type_id: 'Tipo de evento',
  date: 'Fecha',
  role: 'Rol',
  reason: 'Motivo',
  kind: 'Tipo de decisión',
  kinship: 'Comprobación de parentesco',
  female: 'Hembra',
  male: 'Macho',
  lineage_complete: 'Genealogía completa hasta abuelos',
  invalid_lineage: 'Datos genealógicos inconsistentes',
  missing_female: 'Datos faltantes de la hembra',
  missing_male: 'Datos faltantes del macho',
  matches: 'Antepasados compartidos',
  ancestor: 'Antepasado',
  female_paths: 'Relación con la hembra',
  male_paths: 'Relación con el macho',
  depth: 'Generaciones revisadas',
  health_case_id: 'Caso sanitario',
  observation_event_id: 'Observación de origen',
  status: 'Estado',
  start_date: 'Inicio',
  closed_date: 'Cierre',
  notes: 'Notas',
  evolution: 'Evolución',
  treatment_result: 'Resultado del tratamiento',
  next_review_date: 'Próxima revisión',
  diagnosis: 'Diagnóstico',
  severity: 'Gravedad',
  observation: 'Observación',
  product_id: 'Producto',
  program_id: 'Programa sanitario',
  dose_value: 'Dosis',
  applied_at: 'Fecha y hora de aplicación',
  administered_by: 'Aplicada por',
  is_deviation: 'Variación de pauta',
  treatment_event_id: 'Tratamiento',
  dose_unit_id: 'Unidad de dosis',
  route_id: 'Vía de administración',
  frequency_hours: 'Frecuencia en horas',
  duration_days: 'Duración en días',
  withdrawal_days: 'Días de retiro',
  withdrawal: 'Retiro sanitario',
  as_of: 'Fecha de cálculo',
  release_date: 'Fecha estimada de fin de retiro',
  treatment_count: 'Tratamientos',
  unknown_count: 'Periodos por verificar',
  in_treatment: 'Tratamiento en curso',
  unit_id: 'Unidad',
  product_type_id: 'Tipo de producto',
  unit_code: 'Unidad',
  interval_days: 'Intervalo en días',
  minimum_age_days: 'Edad mínima en días',
  notice_days: 'Días de aviso',
  weight_kg: 'Peso en kg',
  birth_date_snapshot: 'Nacimiento registrado al destete',
  weight_reused: 'Pesaje existente reutilizado',
  male_id: 'Macho',
  result: 'Resultado',
  mating_event_id: 'Monta relacionada',
  birth_type_id: 'Tipo de parto',
  offspring: 'Crías',
  alive: 'Nació vivo',
  birth_weight_kg: 'Peso al nacer',
  exit_type: 'Tipo de salida',
  group_id: 'Lote',
  location_id: 'Ubicación',
  description: 'Descripción',
  from_date: 'Desde',
  until_date: 'Hasta',
  amount: 'Monto',
  supplier_id: 'Proveedor',
  expense_category_id: 'Categoría de gasto',
  income_category_id: 'Categoría de ingreso',
  expense_id: 'Gasto',
  allocations: 'Distribuciones',
  feed_id: 'Alimento',
  quantity: 'Cantidad',
  effective_from: 'Vigente desde',
  unit_cost: 'Costo unitario',
  cost: 'Costo',
  old_values: 'Valores anteriores',
  new_values: 'Valores nuevos',
};
export const fieldLabel = (field: string) =>
  field
    .split('.')
    .map((part) => fields[part] ?? part.replaceAll('_', ' '))
    .join(' · ') || 'Registro';
const values: Record<string, string> = {
  male: 'Macho',
  female: 'Hembra',
  born_in_herd: 'Nacido en el hato',
  purchased: 'Comprado',
  donated: 'Donado',
  other: 'Otro',
  open: 'Abierto',
  under_treatment: 'En tratamiento',
  closed: 'Cerrado',
  mild: 'Leve',
  moderate: 'Moderada',
  severe: 'Grave',
  critical: 'Crítica',
  pregnant: 'Gestante',
  empty: 'Vacía',
  uncertain: 'Dudosa',
  sale: 'Venta',
  death: 'Muerte',
  slaughter: 'Sacrificio',
  transfer: 'Traspaso',
  theft: 'Robo',
  pending: 'Retiro pendiente',
  complete: 'Sin retiro pendiente según registros',
  unknown: 'Por verificar',
  no_records: 'Sin tratamientos registrados',
  related: 'Parentesco registrado',
  no_relationship_found: 'Sin parentesco encontrado hasta abuelos',
  insufficient_data: 'Datos genealógicos incompletos',
  direct_ancestor: 'Progenitor o abuelo del otro animal',
  shared_parent: 'Progenitor compartido',
  shared_grandparent: 'Abuelo compartido',
  parent_grandparent: 'Progenitor de uno y abuelo del otro',
  retain_breeding: 'Conservar para reproducción',
  exclude_breeding: 'Descartar para reproducción',
  separate: 'Separar del resto del hato',
  sale_planned: 'Venta prevista',
  purchase_reason: 'Motivo de compra',
  improved: 'Mejoró',
  unchanged: 'Sin cambios',
  worsened: 'Empeoró',
  recovered: 'Recuperado',
  not_assessed: 'Aún no evaluado',
  effective: 'Efectivo',
  partially_effective: 'Parcialmente efectivo',
  not_effective: 'Sin efecto observado',
};
export function formatValue(value: unknown, field = ''): string {
  if (value === null || value === undefined) return 'Sin valor';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value))
    return value.length ? value.map((v) => formatValue(v, field)).join('\n') : 'Lista vacía';
  if (typeof value === 'object')
    return (
      Object.entries(value)
        .map(([key, v]) => `${fieldLabel(key)}: ${formatValue(v, key)}`)
        .join('\n') || 'Sin campos'
    );
  if (typeof value === 'string') {
    if (['female_paths', 'male_paths', 'missing_female', 'missing_male'].includes(field)) {
      if (value === 'self') return 'El animal seleccionado';
      if (/^(mother|father)(\.(mother|father))?$/.test(value))
        return value
          .split('.')
          .map((part) => (part === 'mother' ? 'Madre' : 'Padre'))
          .join(' → ');
    }
    if (field === 'permissions') return permissionLabel(value);
    if (field === 'role_id') return roleLabel(value);
    if (value === '') return 'Texto vacío';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
    // Only translate enum fields; user names and free text must retain their content.
    if (
      [
        'sex',
        'origin',
        'status',
        'severity',
        'result',
        'exit_type',
        'kind',
        'evolution',
        'treatment_result',
      ].includes(field)
    )
      return values[value] ?? value;
  }
  return String(value);
}
export function changeValue(change: AuditChange, side: 'before' | 'after'): string {
  if (!change[(side + '_present') as 'before_present' | 'after_present']) return 'No existía';
  const label = change[(side + '_label') as 'before_label' | 'after_label'];
  return formatValue(label ?? change[side], change.field.split('.').at(-1));
}
