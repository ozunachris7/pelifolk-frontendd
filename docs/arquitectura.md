# Arquitectura de Pelifolk

## Decisión

Frontend Angular organizado por funcionalidades (Feature-Based Architecture), con principios de Clean Architecture dentro de cada funcionalidad. No existe una carpeta `layout`: la composición general corresponde a la página `dashboard` con un `router-outlet` hijo y los componentes visuales reutilizables a `shared/ui`.

Esta organización agrupa áreas del negocio; no es una implementación estricta de Vertical Slice por cada acción. Los casos de uso representan las acciones dentro de cada área.

La fuente de requisitos es `PROYECTO APP PELIFOLK ING NIVON.docx`. Describe descubrimiento de necesidades; las decisiones de implementación aquí son propuestas técnicas, no requisitos adicionales del documento.

## Estructura

```text
src/app/
├── core/
│   ├── auth/
│   └── http/
├── shared/
│   └── ui/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── ranches/
│   ├── users/
│   ├── animals/
│   ├── health/
│   ├── breeding/
│   ├── management/
│   ├── finance/
│   └── reports/
├── app.ts
├── app.config.ts
└── app.routes.ts
```

Cada funcionalidad cuenta con:

```text
health/
├── domain/          # Entidades, reglas y contratos de repositorios
├── application/     # Casos de uso que coordinan reglas y repositorios
├── infrastructure/  # Adaptadores HTTP, DTO y conversión de datos
└── presentation/    # Páginas, componentes y estado de la interfaz
```

Los nombres de carpetas, clases y rutas usan inglés; los textos visibles de la interfaz usan español. El dashboard compone el header y el sidebar globales de `shared/ui`, y carga las páginas mediante un `router-outlet` hijo. Su ruta principal es `/dashboard/overview`.

Las rutas secundarias se cargan bajo demanda. Las opciones pendientes comparten una pantalla informativa temporal en `shared/ui/section-placeholder`, que se reemplazará por las páginas de cada funcionalidad al implementarlas. Esta pantalla no contiene lógica de negocio ni simula datos.

## Responsabilidades de negocio

| Funcionalidad | Responsabilidad                                                  | Ejemplos de casos de uso                                       |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| ranches       | Rancho, corrales y ubicaciones                                   | Registrar corral, consultar rancho                             |
| users         | Personas y asignación de roles por rancho                        | Asignar rol, consultar miembros                                |
| animals       | Identidad, nacimiento, estado y consulta del historial integral  | Registrar animal, consultar ficha e historial                  |
| health        | Observaciones, diagnósticos, tratamientos y seguimiento          | Reportar hallazgo, registrar diagnóstico, registrar aplicación |
| breeding      | Cruzas, gestaciones, partos, parentesco y desempeño reproductivo | Registrar cruza, registrar parto, consultar genealogía         |
| management    | Pesajes, alimentación, movimientos e incidentes de manejo        | Registrar peso, trasladar animal, registrar incidente          |
| finance       | Gastos, ingresos, compras y ventas                               | Registrar gasto, registrar venta                               |
| reports       | Lecturas agregadas del hato y sus resultados                     | Consultar pendientes, consultar indicadores económicos         |

`animals` conserva la identidad del animal; `breeding` gestiona los vínculos genealógicos. El historial integral reúne registros de las distintas áreas sin duplicar su propiedad. Las ventas pertenecen a `finance`, pero deben coordinar el cambio de estado del animal en el backend dentro de una transacción.

## Reglas de dependencia

- `domain` usa TypeScript independiente de Angular, HTTP, almacenamiento y componentes.
- `application` depende de `domain`; recibe repositorios mediante sus contratos. Los casos de uso permanecen independientes de Angular.
- `infrastructure` implementa esos contratos; puede usar `HttpClient` y la inyección de dependencias de Angular. Convierte DTO de la API a modelos del dominio.
- `presentation` invoca casos de uso; utiliza signals para estado visual y RxJS donde sea necesario para flujos asíncronos. No consulta directamente `HttpClient` ni implementa reglas de negocio.
- Los proveedores de Angular conectan contratos y adaptadores en la configuración o rutas de la funcionalidad. Es el punto de composición de dependencias.
- Una funcionalidad no importa adaptadores, componentes o estado internos de otra. Las consultas integradas y operaciones entre áreas se resuelven mediante contratos explícitos de API.
- `core` contiene infraestructura transversal: sesión, conexión HTTP e interceptores. Las reglas y entidades de negocio permanecen en su funcionalidad.
- `shared/ui` contiene componentes visuales genéricos, sin reglas de negocio ni acceso a API. Solo se mueve código allí cuando existe reutilización real.

Flujo de ejecución:

```text
Página → caso de uso → contrato de repositorio → adaptador HTTP → API
```

El contrato es propiedad del dominio; su implementación está en infraestructura. La dirección de ejecución no cambia la dirección de dependencia del código.

## Backend y autenticación

### Login conectado

La página `/login` contiene únicamente inicio de sesión, sin registro. `features/auth/presentation` gestiona el formulario y `core/auth` contiene la sesión compartida y los guards. `Session` envía las credenciales al backend con HttpClient. La sesión guarda el token y su vencimiento en `sessionStorage`, nunca la contraseña. Al recargar, obtiene la identidad con `/api/v1/auth/me` antes de permitir el acceso al dashboard. La URL del backend se configura en `core/http/api-url.ts`.

El dashboard y sus rutas hijas requieren sesión. El login redirige a la sección solicitada dentro del dashboard; cerrar sesión limpia el almacenamiento, solicita la invalidación del token al backend y vuelve a `/login`. Los guards locales no sustituyen la autorización de cada endpoint en el servidor.

El repositorio actual contiene el frontend. El backend está en `pelifolk_backend`, usa Python/FastAPI y MySQL, e implementa autenticación, usuarios y roles. El frontend conecta login, validación de sesión, logout y administración de usuarios, roles y permisos; los módulos ganaderos siguen pendientes.

### Administración de accesos

`features/users/domain` define los modelos, contrato de persistencia y reglas para mostrar acciones permitidas. `application/ManageAccess` coordina operaciones y valida los permisos locales antes de enviarlas. `infrastructure/HttpAccessRepository` implementa el contrato HTTP; los proveedores de las rutas conectan el repositorio con el caso de uso. `presentation` contiene las pantallas de usuarios y roles, con formularios y estados de carga, error y confirmación. El interceptor en `core/http` adjunta el Bearer solo a la API configurada, gestiona sesiones rechazadas y refresca la identidad cuando cambian sus permisos. Las restricciones definitivas siguen en el backend.

El backend es responsable de permisos, validaciones definitivas, transacciones, persistencia e historial de auditoría. Los guards y botones de Angular facilitan la navegación, pero no sustituyen la autorización del servidor. La separación de datos por rancho todavía no está implementada.

## Historial y trazabilidad

- Los registros históricos deben conservar autor, rancho, animal cuando aplique, fecha del hecho y fecha del registro.
- Una observación, un diagnóstico y una aplicación de tratamiento son hechos distintos; no se sobrescriben entre sí.
- Se propone corregir mediante rectificaciones vinculadas al registro original, conservando motivo y autor. Debe validarse esta política: el documento prohíbe borrar o corregir historia, pero también permite al dueño modificar todo.
- Conservar registros históricos no obliga a implementar Event Sourcing. Un modelo relacional con historial y auditoría puede cubrir la necesidad inicial.
- Los costos directos de un animal se distinguen de gastos generales del rancho; cualquier reparto de gastos debe tener una regla explícita.
- La validación genealógica debe impedir parentescos imposibles y ciclos. Las alertas reproductivas y criterios de selección requieren reglas acordadas con los responsables del rancho.

## Conectividad

La primera versión puede operar con conexión. El registro sin internet es una decisión pendiente: el documento contempla esperar hasta volver a la oficina. Si se incorpora sincronización, se deben definir almacenamiento local, identificadores, prevención de duplicados y resolución de conflictos antes de implementar ese flujo.

## Convenciones de desarrollo

- Generar componentes con Angular CLI: `ng g c ruta --skip-tests`.
- Los componentes usan clases Tailwind en sus templates y no tienen archivos CSS. Angular CLI configura `style: none`. `src/styles.css` es únicamente la entrada de Tailwind, la variante de modo oscuro y la definición de Poppins.
- El selector del header alterna modo claro y oscuro y conserva la preferencia en almacenamiento local. El menú del perfil contiene la acción de cerrar sesión.
- Ejemplo: `ng g c features/animals/presentation/pages/animal-list --skip-tests`.
- `angular.json` configura `skipTests: true` para componentes nuevos. Los tests existentes no se eliminan.
- Crear archivos y subcarpetas adicionales cuando una funcionalidad los necesite; evitar capas de delegación sin propósito.
- Verificar la compilación después de cambios estructurales. Incorporar pruebas específicas cuando se implementen reglas relevantes como permisos, genealogía o rectificaciones.

## Orden inicial de implementación

1. Sesión, usuarios, roles y contexto de rancho.
2. Registro e identificación de animales e historial básico.
3. Hallazgos sanitarios, diagnósticos, tratamientos y pendientes.
4. Manejo, reproducción y genealogía.
5. Economía e indicadores.

Referencias: [organización por funcionalidades](https://angular.dev/style-guide) y [carga de rutas](https://angular.dev/guide/routing/loading-strategies).
