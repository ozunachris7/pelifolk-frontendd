import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

const MESSAGES: Record<string, string> = {
  'Income animal not found': 'El animal vinculado al ingreso ya no está disponible.',
  'Income date is before animal birth':
    'La fecha del ingreso no puede ser anterior al nacimiento del animal.',
  'Product unit changed before price entry':
    'La unidad del producto cambió. Actualiza la lista antes de registrar el precio.',
  'Product price already exists on date':
    'Ya existe un precio para esa fecha. Consulta el historial antes de continuar.',
  'Product unit has price history':
    'La unidad no se puede cambiar porque el producto tiene precios registrados.',
  'Use the product price history to add a price':
    'Agrega el precio desde el historial de precios del producto.',
  'Active ingredient not found':
    'El principio activo ya no está disponible. Actualiza la búsqueda.',
  'Active ingredient already exists': 'Ya existe un principio activo con ese nombre.',
  'Active ingredient is assigned to products':
    'El principio activo está asignado a productos. Quita esas asignaciones antes de eliminarlo.',
  'Treatment not found': 'El tratamiento no está disponible para este producto.',
  'Treatment has been replaced':
    'El tratamiento fue reemplazado. Consulta el historial actualizado.',
  'Reopen case before recording a dose': 'Reabre el caso antes de registrar una dosis aplicada.',
  'Dose date is before case start': 'La aplicación no puede quedar antes del inicio del caso.',
  'Dose variation requires explanation':
    'Explica en las notas por qué la aplicación difiere de la pauta indicada.',
  'Dose already recorded at this time':
    'Ya hay una dosis registrada para este tratamiento y producto a esa misma hora. Consulta la bitácora.',
  'Closed date is before an applied dose': 'El caso no puede cerrarse antes de una dosis aplicada.',
  'Birth date conflicts with applied dose history':
    'El nacimiento no puede quedar después de una dosis aplicada.',

  'Observation not found': 'La observación no está disponible.',
  'Observation has been replaced':
    'La observación fue reemplazada. Actualiza la lista antes de continuar.',
  'Observation and case belong to different animals':
    'La observación y el caso deben pertenecer al mismo animal.',
  'Case start date is before source observation':
    'El inicio del caso debe ser igual o posterior a la observación de origen.',
  'Observation already linked to another case':
    'Esta observación ya está vinculada a otro caso. Actualiza la lista para consultarlo.',
  'Weaning date must be after birth date': 'La fecha de destete debe ser posterior al nacimiento.',
  'Animal already has a weaning record': 'Este animal ya tiene un destete registrado.',
  'Weaning weight differs from existing daily weight':
    'Ya hay un pesaje con otro valor en esa fecha. Consulta los pesajes y usa el mismo peso para registrar el destete.',
  'Multiple weights exist on weaning date':
    'Hay varios pesajes en esa fecha. Revisa el historial antes de registrar el destete.',
  'Decision date is before birth date':
    'La decisión no puede quedar antes del nacimiento del animal.',
  'Birth date conflicts with decision history':
    'El nacimiento no puede quedar después de una decisión registrada.',
  'Health case is closed':
    'El caso está cerrado. Vuelve a consultarlo antes de registrar el seguimiento.',
  'Followup date is before case start': 'El seguimiento no puede quedar antes del inicio del caso.',
  'Closed date is before a followup':
    'El cierre no puede quedar antes de un seguimiento registrado.',
  'Treatment result requires a recorded case treatment':
    'Registra un tratamiento del caso antes de evaluar su resultado.',
  'Location has assigned animals':
    'Traslada primero a los animales antes de desactivar esta ubicación.',
  'Movement date must be after the last location record':
    'La fecha del traslado debe ser posterior al último registro de ubicación.',
  'Animal is already at this location': 'El animal ya está en esa ubicación.',
  'Birth date conflicts with location history':
    'El nacimiento no puede quedar después de un registro de ubicación.',

  'Feed not found': 'El alimento ya no está disponible.',
  'Feed unit not found': 'La unidad no está disponible.',
  'Feed already exists': 'Ya existe un alimento con ese nombre.',
  'Feed unit has history':
    'La unidad no se puede cambiar porque el alimento tiene precios o consumos registrados.',
  'Feed price already exists on date':
    'Ya hay un precio para esa fecha. Registra el siguiente precio con otra fecha de vigencia.',
  'Feed has no price on feeding date':
    'Registra un precio del alimento vigente en la fecha del consumo.',
  'Group has no members on feeding date': 'El lote no tiene animales en la fecha del consumo.',
  'Feeding date is before birth': 'El consumo no puede ser anterior al nacimiento del animal.',
  'Birth date conflicts with feeding history':
    'El nacimiento no puede quedar después de un consumo registrado.',

  'Finance category not found': 'La categoría ya no está disponible.',
  'Finance category already exists': 'Ya existe una categoría con ese nombre.',
  'Finance category has records':
    'La categoría tiene movimientos asociados y no se puede eliminar.',
  'Supplier not found': 'El proveedor ya no está disponible.',
  'Supplier already exists': 'Ya existe un proveedor con ese nombre.',
  'Supplier is inactive': 'Activa el proveedor antes de asignarlo a un nuevo gasto.',
  'Finance record not found': 'El movimiento ya no está disponible.',
  'Income requires a sale exit': 'Selecciona una salida por venta válida.',
  'Income date is before sale date': 'El ingreso no puede ser anterior a la venta.',
  'Sale already has an income': 'Esa venta ya tiene un ingreso registrado.',
  'Invalid finance date range': 'La fecha inicial no puede ser posterior a la final.',

  'Animal already has an exit': 'El animal ya tiene una salida registrada.',
  'Exit date is before birth date': 'La salida no puede ser anterior al nacimiento.',
  'Exit date conflicts with animal history':
    'Hay registros posteriores a esa fecha. Revisa el historial y la fecha de salida.',
  'Activity date is after animal exit': 'La fecha no puede ser posterior a la salida del animal.',
  'Reproductive animal sex is incompatible':
    'La madre o hembra debe ser hembra y el padre o macho debe ser macho.',
  'Reproductive event must be after animal birth':
    'La fecha debe ser posterior al nacimiento de los padres.',
  'Mating does not belong to this female': 'La monta seleccionada no pertenece a esta hembra.',
  'Pregnancy diagnosis is before mating':
    'El diagnóstico no puede ser anterior a la monta relacionada.',
  'Birth type not found': 'El tipo de parto no está disponible.',
  'Female already has a birth on this date': 'La hembra ya tiene un parto registrado en esa fecha.',
  'Birth-linked parentage and birth date cannot be changed':
    'La fecha de nacimiento y los padres están vinculados a un parto registrado.',
  'Sex conflicts with reproductive history':
    'El sexo no se puede cambiar porque el animal tiene historial reproductivo.',
  'Birth date conflicts with reproductive history':
    'El nacimiento debe ser anterior a los eventos reproductivos registrados.',
  'Health program not found': 'El programa sanitario ya no está disponible.',
  'Health program name already exists': 'Ya existe un programa con ese nombre.',
  'Cannot change product of a program with applications':
    'El programa ya tiene aplicaciones. Conserva su producto o crea otro programa.',
  'Health program is inactive': 'Activa el programa antes de registrar aplicaciones.',
  'Animal sex does not match health program':
    'El animal no coincide con el sexo configurado en el programa.',
  'Animal has not reached program minimum age':
    'Revisa el nacimiento: el animal debe cumplir la edad mínima en la fecha de aplicación.',
  'Animal has left the herd': 'El animal tiene una salida registrada y ya no pertenece al hato.',
  'Application date must be after last program application':
    'La fecha debe ser posterior a la última aplicación de este programa.',
  'Reaction date is before birth date': 'La reacción no puede ser anterior al nacimiento.',
  'Applied dose not found': 'La dosis seleccionada ya no está disponible.',
  'Applied dose belongs to another animal': 'La dosis debe pertenecer al mismo animal.',
  'Reaction date is before applied dose': 'La reacción no puede ser anterior a la dosis vinculada.',
  'Product differs from applied dose': 'El producto debe coincidir con la dosis vinculada.',
  'Reaction not found': 'El reporte ya no está disponible.',
  'Reaction follow-up is already closed': 'El seguimiento ya fue cerrado. Actualiza el listado.',
  'Closure date is before reaction date': 'El cierre no puede ser anterior a la reacción.',
  'Birth date conflicts with reaction history':
    'El nacimiento no puede ser posterior a una reacción registrada.',
  'Incident date is before birth date': 'El incidente no puede ser anterior al nacimiento.',
  'Incident case belongs to another animal': 'Selecciona un caso del mismo animal.',
  'Incident case not found': 'El caso relacionado ya no está disponible.',
  'Incident not found': 'El incidente ya no está disponible.',
  'Abortion incident requires a female': 'Un reporte de aborto debe corresponder a una hembra.',
  'Sex conflicts with abortion history':
    'El animal tiene un aborto reportado; no se puede cambiar a macho.',
  'Birth date conflicts with incident history':
    'El nacimiento no puede ser posterior a un incidente registrado.',
  'Incident changed; reload before updating':
    'El incidente recibió un seguimiento nuevo. Cierra y vuelve a abrir el detalle antes de guardar.',
  'Follow-up date is before incident history':
    'La fecha no puede ser anterior al incidente ni al último seguimiento.',
  'Product not found': 'El producto ya no está disponible.',
  'Product name already exists': 'Ya existe un producto con ese nombre.',
  'Product catalog entry not found': 'Selecciona un tipo y una unidad disponibles.',
  'Product is inactive': 'El producto está inactivo. Actívalo para registrar tratamientos.',
  'Treatment catalog entry not found': 'Selecciona una unidad y una vía disponibles.',
  'Reopen the case before adding a treatment': 'Reabre el caso antes de registrar un tratamiento.',
  'Treatment date is before case start date':
    'El tratamiento no puede comenzar antes del inicio del caso.',
  'Closed date is before treatment ends':
    'El cierre no puede ser anterior al último día del tratamiento.',
  'Reopen the case before adding a diagnosis':
    'El caso está cerrado. Reábrelo antes de agregar un diagnóstico.',
  'Diagnosis date is before case start date':
    'El diagnóstico no puede ser anterior al inicio del caso.',
  'Closed date is before a diagnosis':
    'El cierre no puede ser anterior a un diagnóstico registrado.',
  'Health date is before birth date':
    'La fecha del registro sanitario no puede ser anterior al nacimiento.',
  'Health case not found': 'El caso sanitario ya no está disponible.',
  'Health case changed; reload before updating':
    'El caso cambió. Cierra y vuelve a abrirlo antes de actualizar su estado.',
  'Health case already has this status': 'El caso ya tiene ese estado.',
  'Closed date is before case start date': 'El cierre no puede ser anterior al inicio del caso.',
  'Birth date conflicts with health history':
    'El nacimiento no puede ser posterior a un registro sanitario.',
  'Weight date is before birth date': 'La fecha del pesaje no puede ser anterior al nacimiento.',
  'Animal already has a weight on this date': 'Este animal ya tiene un pesaje en esa fecha.',
  'Birth date conflicts with weight history':
    'El nacimiento no puede ser posterior a un pesaje registrado.',
  'Location not found': 'La ubicación ya no está disponible.',
  'Location type not found': 'El tipo de ubicación seleccionado no está disponible.',
  'Location type already exists': 'Ese tipo de ubicación ya existe.',
  'Location name already exists': 'Ya existe una ubicación con ese nombre.',
  'Group not found': 'El lote ya no está disponible.',
  'Group name already exists': 'Ya existe un lote con ese nombre.',
  'Group has assigned animals': 'Mueve o retira los animales antes de desactivar el lote.',
  'Group is inactive': 'El lote está inactivo. Actívalo antes de asignar animales.',
  'Movement date must be after current admission':
    'La fecha del cambio debe ser posterior al ingreso actual. Solo puede registrarse un ingreso por día.',
  'Birth date conflicts with group history':
    'El nacimiento no puede ser posterior a un ingreso del animal en un lote.',
  'Movement date cannot precede birth':
    'La fecha del movimiento no puede ser anterior al nacimiento del animal.',
  'Movement overlaps existing history':
    'La fecha del movimiento se cruza con un periodo ya registrado.',
  'Animal already belongs to this group': 'Uno de los animales ya pertenece a este lote.',
  'Animal already belongs to another group':
    'Hay animales en otros lotes. Activa la opción de moverlos para continuar.',
  'Animal is no longer assigned to this group':
    'El animal ya no pertenece a este lote. Actualiza el listado.',

  'Physical evaluation criteria changed; reload the form':
    'Los criterios cambiaron. Cierra y vuelve a abrir el formulario.',
  'Physical evaluation date is before birth date':
    'La evaluación no puede ser anterior al nacimiento.',
  'Birth date conflicts with physical evaluation history':
    'El nacimiento no puede ser posterior a una evaluación física registrada.',
  'Breeding assessment criteria changed; reload the form':
    'Los criterios cambiaron. Cierra y vuelve a abrir el formulario.',
  'Assessment birth not found': 'Selecciona un parto registrado disponible.',
  'Assessment birth has been replaced': 'El parto fue sustituido. Selecciona el registro vigente.',
  'Assessment date is before birth event': 'La evaluación no puede ser anterior al parto.',
  'Assessment offspring does not belong to birth': 'Selecciona una cría del parto elegido.',
  'Assessment date is before animal birth': 'La evaluación no puede ser anterior al nacimiento.',
  'Birth date conflicts with breeding assessment history':
    'El nacimiento no puede ser posterior a una evaluación materna o de cría.',
  'Indicator dates cannot exceed observation cutoff':
    'Las fechas del periodo no pueden superar la fecha de corte, y el corte no puede ser futuro.',
  'Reproductive indicators require a female': 'Estos indicadores se consultan por hembra.',
  'Offspring is not in this performance cohort':
    'La cría no pertenece a este progenitor o al periodo seleccionado. Actualiza el reporte.',
  'Animal not found': 'El animal ya no está disponible.',
  'Breed not found': 'La raza seleccionada no está disponible.',
  'Breed is assigned to animals':
    'La raza está asignada a animales. Cambia sus razas antes de eliminarla.',
  'Breed already exists': 'Esa raza ya existe en el catálogo.',
  'SINIIGA already exists': 'Ya existe un animal con ese SINIIGA.',
  'Parent not found': 'El padre o la madre seleccionados no están disponibles.',
  'Parent sex is incompatible': 'La madre debe ser hembra y el padre debe ser macho.',
  'Parent must be born before offspring': 'Los padres deben haber nacido antes que sus crías.',
  'Genealogy cannot contain cycles':
    'El parentesco genera un ciclo: el animal no puede ser su propio antepasado.',
  'Sex conflicts with existing offspring':
    'El sexo no se puede cambiar porque este animal ya figura como padre o madre.',

  'Owner role cannot be modified':
    'El rol del dueño está protegido para conservar el acceso administrativo.',
  'Initial system role names cannot be changed':
    'Los nombres de los roles iniciales no se pueden cambiar.',
  'Initial system roles cannot be deleted': 'Los roles iniciales no se pueden eliminar.',
  'Initial system roles cannot be modified or deleted': 'Este rol inicial está protegido.',
  'Role is assigned to users':
    'El rol tiene usuarios asignados. Cambia sus roles antes de eliminarlo.',
  'You cannot modify your own assigned role': 'No puedes modificar el rol que tienes asignado.',
  'Health actions require health:read':
    'Las acciones sanitarias requieren el permiso de consultar Sanidad.',
  'Corrected data must differ from the original':
    'Los datos corregidos deben ser distintos del registro original.',
  'History entry not found': 'No se encontró el registro del historial.',
  'History entry is unavailable or has changed; reload history':
    'El registro cambió o ya fue sustituido. Recarga el historial.',
  'History changed; reload the rectification before saving':
    'El registro o sus aclaraciones cambiaron. Recarga la rectificación antes de guardar.',
  'This entry only allows a historical clarification':
    'Este registro solo permite agregar una aclaración histórica.',
  'Rectification must preserve the original animal':
    'La corrección debe conservar el mismo animal.',
  'Cannot grant or manage permissions you do not have':
    'Solo puedes administrar permisos que ya tienes.',
  'Cannot assign permissions you do not have':
    'El rol seleccionado tiene permisos superiores a los tuyos.',
  'Cannot modify a user with higher permissions':
    'Esta cuenta tiene permisos superiores a los tuyos.',
  'You cannot change your own role or deactivate your own account':
    'No puedes cambiar tu propio rol ni desactivar tu cuenta.',
  'You cannot deactivate your own account': 'No puedes desactivar tu propia cuenta.',
  'Duplicate value or invalid relationship':
    'Ya existe un registro con esos datos o la relación seleccionada no es válida.',
  'User not found': 'El usuario ya no está disponible.',
  'Role not found': 'El rol ya no está disponible.',
};

export function apiError(error: unknown, fallback: string): string {
  if (error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0)) {
    return 'No se pudo conectar con el servidor. Intenta nuevamente.';
  }
  if (error instanceof HttpErrorResponse) {
    const detail: unknown = error.error?.detail;
    if (typeof detail === 'string' && MESSAGES[detail]) return MESSAGES[detail];
    if (error.status === 401) return 'Tu sesión terminó. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes permiso para realizar esta acción.';
    if (error.status === 422) return 'Revisa los datos del formulario.';
    if (error.status === 503) return 'El servicio no está disponible. Intenta nuevamente.';
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
