# Pelifolk

Sistema de gestión del hato y su historial sanitario, reproductivo, genealógico y económico.

La estructura usa Feature-Based Architecture con principios de Clean Architecture, sin carpeta `layout`. Consulta [la arquitectura y sus convenciones](docs/arquitectura.md).

Para generar componentes: `ng g c ruta --skip-tests`.

## Login conectado a la API

El login usa `POST http://localhost:8000/api/v1/auth/login` con correo y contraseña de un usuario creado en el backend. La URL está en `src/app/core/http/api-url.ts`. No hay registro de usuarios en este frontend.

Iniciar la API desde `pelifolk_backend` con `python -m uvicorn main:app --reload` y este frontend con `npm start`. Abrir `http://localhost:4200`. En el backend, `CORS_ORIGINS` debe incluir `http://localhost:4200`. Las credenciales de MySQL y el secreto JWT permanecen en el backend.

La sesión usa exclusivamente la cookie `pelifolk_session`, administrada por el navegador y marcada `HttpOnly` por la API. No se guardan tokens ni contraseñas en Web Storage; se elimina el token de versiones anteriores de `sessionStorage`. Al recargar, `GET /api/v1/auth/me` recupera y valida la sesión. Cerrar sesión espera `POST /api/v1/auth/logout` antes de ir al login; si falla la conexión, permite reintentar porque JavaScript no puede borrar la cookie. Los errores de credenciales y de conexión se muestran en el formulario.

El interceptor usa `withCredentials: true` para todas las solicitudes a la API, incluido login, y añade `X-CSRF-Protection: 1` en POST, PUT, PATCH y DELETE. No añade credenciales ni ese header a servicios externos. En desarrollo usar `localhost` para ambos servidores. En producción se usa `/api/v1` en el mismo origen con HTTPS; si se cambia a una API en otro sitio, configurar `CORS_ORIGINS`, `AUTH_COOKIE_SAMESITE=none` y `ENVIRONMENT=production` en el backend. Las restricciones del navegador sobre cookies de terceros pueden impedir ese despliegue.

## Usuarios, roles y permisos

El menú incluye `/dashboard/users` y `/dashboard/roles` según los permisos de la sesión. Usuarios permite listar cuentas por páginas, crear y editar sus datos, asignar roles, cambiar contraseñas y activar/desactivar cuentas. Nombre y segundo nombre son campos separados; el segundo nombre y teléfono son opcionales. Las contraseñas nuevas tienen al menos 8 caracteres; al editar, dejar la contraseña vacía conserva la actual.

Roles y permisos permite consultar el catálogo, crear roles, editar sus permisos y eliminar roles personalizados sin usuarios asignados. El dueño conserva el acceso administrativo; los nombres de los roles iniciales no se cambian y esos roles no se eliminan. No se puede editar el rol propio ni otorgar permisos superiores a los de la sesión.

Las llamadas a esta API envían la cookie de sesión automáticamente. Una sesión rechazada redirige al login; un rechazo de permisos refresca la identidad desde el servidor. Cambiar la contraseña de la cuenta actual exige iniciar sesión nuevamente. Desactivar usuarios conserva su historial. La autorización definitiva siempre la aplica el backend.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.10.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.


La sección Animales conecta listado, búsqueda, paginación, ficha y altas/ediciones a la API. Incluye catálogo de razas y búsqueda de madre/padre. Los permisos `animals:read` y `animals:write` se asignan en Roles y permisos; la migración de la API los concede inicialmente al dueño y al administrador. Después de reiniciar la API, vuelve a iniciar sesión para actualizar los accesos visibles.

La vista **Razas** (`/dashboard/breeds`) permite buscar, crear, renombrar y eliminar razas. Las razas asignadas a animales no se pueden eliminar. La modal de registro/edición de animales conserva la opción de registrar una raza nueva.


Las vistas **Ubicaciones** y **Lotes** conectan sus catálogos con la API. Cada lote tiene una vista de animales actuales e historial paginado, con asignación múltiple, traslado a otro lote activo y retiro con fecha efectiva. Las ubicaciones y lotes se desactivan desde su formulario de edición. Un lote debe quedar sin animales antes de desactivarse. Los permisos `locations:read/write` y `groups:read/write` se asignan desde Roles y permisos; la migración de arranque los concede inicialmente al dueño y administrador.
