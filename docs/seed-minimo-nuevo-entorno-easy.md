# Seed mínimo requerido para nuevos entornos (caso EASY)

## Contexto

Al provisionar un entorno Supabase nuevo (por ejemplo EASY), es habitual aplicar solo el esquema (`estructura_base.sql` o equivalente) y poblar usuarios de aplicación (`app_users`, `app_credentials`). Eso deja la base consistente a nivel de tablas y credenciales, pero no garantiza que el portal admin respete la autorización por permisos.

## Qué pasó

Tras crear el entorno EASY con estructura y usuarios, el flujo de autenticación funcionaba de punta a punta: credenciales válidas, sesión interna (`app_sessions` / cookie), y resolución del rol del usuario. Aun así, al entrar al dashboard administrativo la UI mostraba **«No autorizado»** u comportamiento equivalente de acceso denegado pese a un login aparentemente correcto.

## Causa raíz

El middleware y/o la capa RBAC del admin no solo comprueban que exista un usuario activo y un rol; también consultan **permisos** asociados al rol vía `role_permissions` y la tabla `permissions`. Si:

- `permissions` está **vacía**, o
- `role_permissions` está **vacía o incompleta** para el `role_id` del usuario,

entonces el usuario autenticado no recibe las capacidades esperadas y el front o el API responden como no autorizado aunque el login y el rol en `app_users` sean correctos.

En resumen: **autenticación OK, autorización KO** por falta de seed de datos de permisos.

## Tablas mínimas requeridas

Para un entorno nuevo usable con login + admin coherente, conviene considerar **seed mínimo** (además del esquema) en al menos estas tablas:

| Tabla | Rol en el seed mínimo |
|-------|------------------------|
| `roles` | Filas base (p. ej. nombres que el código y `app_users.role_id` esperan). |
| `permissions` | Definición de permisos que el RBAC consulta (rutas o acciones). |
| `role_permissions` | Enlace `role_id` ↔ `permission_id` para que cada rol tenga alcance real. |
| `app_users` | Usuarios de la aplicación, con `role_id` apuntando a `roles`. |
| `app_credentials` | Credenciales (p. ej. `username` + `password_hash` para el login interno). |
| `config` | Parámetros de portal/app que el admin o features leen al arrancar (según uso del proyecto). |

Sin las tres primeras pobladas de forma alineada con el código, el síntoma típico es login y sesión correctos con **dashboard «No autorizado»**.

## Recomendación operativa futura

1. **Tratar el seed de autorización como obligatorio** en el checklist de un entorno nuevo: no dar por cerrado el entorno solo con DDL + `app_users` / `app_credentials`.
2. **Versionar scripts SQL o documentos** que inserten `roles`, `permissions`, `role_permissions` (y `config` si aplica) de forma idempotente o documentada, reutilizables desde prototipo → staging → EASY u otros clones.
3. Tras migrar datos mínimos, **verificar con un usuario de prueba**: login, cookie de sesión, y al menos una ruta de admin que antes devolvía «No autorizado» debe responder 200 / UI normal.
4. Si se clona un entorno existente, **copiar o regenerar explícitamente** las filas de `permissions` y `role_permissions` coherentes con la versión del código desplegado.

---

*Nota: este documento describe el aprendizaje del caso EASY; no sustituye la lectura del esquema actual ni de los scripts de seed concretos del repositorio.*
