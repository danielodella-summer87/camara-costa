# Propuesta: roles operativos de leads (comercial, técnico, consultor)

**Objetivo:** Definir y dejar preparada la base funcional para 3 roles operativos de leads sin tocar aún login, PIN, seeds ni usuarios de prueba.

---

## 1. Dónde está definido hoy

### 1.1 Roles

| Ubicación | Qué hay |
|-----------|--------|
| **`app/lib/rbac.ts`** | `RoleKey = "admin" \| "operador" \| "comercial" \| "viewer"`. No existen aún `tecnico` ni `consultor`. `PERMISSIONS_BY_ROLE` y `PATH_ROLES` son el mapa estático por rol. |
| **`NORMALIZED_ROLES`** | `["admin", "operador", "comercial", "viewer"]`. |
| **`ROLE_ALIASES`** | `operaciones → operador`, `solo_lectura → viewer`, `gerencia → viewer`. |
| **Tabla `roles` (Supabase)** | Definición en DB. Se listan en `/admin/configuracion/roles`. Cada rol tiene `id`, `name`. |
| **Tabla `role_permissions`** | Asignación rol → permisos (IDs). Se edita en `/admin/configuracion/roles/[id]`. |

### 1.2 Permisos

| Ubicación | Qué hay |
|-----------|--------|
| **`app/lib/rbac.ts`** | `PERMISSIONS_BY_ROLE`: admin=`["*"]`, operador=`leads.read`, `leads.write`, `helpdesk.*`, comercial=`leads.read`, `leads.write`, viewer=`leads.read`. |
| **Tabla `permissions` (Supabase)** | Catálogo de permisos (`id`, `key`, `label`, `category`). |
| **`lib/rbac/requirePermission.ts`** | Backend: resuelve usuario por cookie/sesión, consulta `role_permissions` + `permissions`, devuelve usuario si tiene el permiso. Alias: `leads.create` → `leads.write`. |
| **`lib/rbac/extractPermissionKeys.ts`** | Extrae `key` de la respuesta de `role_permissions` join `permissions`. |

### 1.3 Permisos por ruta / módulo

| Ubicación | Qué hay |
|-----------|--------|
| **`app/lib/rbac.ts`** | `PATH_ROLES`: `/admin/configuracion` y `/admin/ia` solo admin; `/admin/operaciones` admin+operador; `/admin/mesa-de-ayuda`, `/admin/agenda`, `/admin/leads` admin+comercial+operador. |
| **`middleware.ts`** | Usa `canAccessPath(user, pathname)`. Si no hay sesión → login; si no `is_active` → 403; si no puede la ruta → 403. Header `x-user-id` con `session.userId`. |
| **`app/admin/configuracion/layout.tsx`** | Layout de configuración: usa `getSession()` (legacy) y `getActiveUserPermissions()`; exige `config.admin` o rol admin/superadmin. |

No hay hoy permisos granulares por “módulo dentro de la ficha del lead” (ej. “solo ver tab IA” o “solo tab técnico”); todo el que puede `/admin/leads` ve la misma página.

### 1.4 Lectura del rol del usuario logueado

| Dónde | Cómo |
|-------|------|
| **API `GET /api/admin/permissions/me`** | Resuelve `app_user` por Supabase Auth o por sesión interna (`getInternalUserIdFromRequest`). Lee `app_users.role_id` → `roles.name`, normaliza con `normalizeRole()`. Devuelve `user.role` y `data` (lista de permission keys de `role_permissions`). |
| **Frontend `usePermissions()`** | Llama a `/api/admin/permissions/me`, guarda `role` y `permissions`. `hasPermission(key)` = `rbacHasPermission(role, key) \|\| permissions.includes(key)`. |
| **Middleware** | Tras validar sesión, lee `app_users` + `roles:role_id(name)`, pasa `roleFromRelation` a `canAccessPath`. |

### 1.5 Restricciones de UI en `/admin/leads` y `/admin/leads/[id]`

| Archivo | Uso actual |
|---------|------------|
| **`app/admin/leads/page.tsx`** | Listado. No hay filtrado por rol en UI; el listado es común. Botón “Nuevo lead” con opciones “Desde entidad” / “Manual”. |
| **`app/admin/leads/[id]/page.tsx`** | Ficha del lead. `usePermissions()` → `hasPermission`, `role`. `canEditLead = hasPermission("leads.write") \|\| isLeadOwner` (comercial dueño del lead). `canDeleteThisLead = role === "admin"`. Botones Editar/Guardar/Cancelar y Eliminar se muestran según esas variables. No hay ocultado de tabs ni bloques por rol. |

---

## 2. Bloques actuales de la ficha del lead, por categoría propuesta

Bloques detectados en `app/admin/leads/[id]/page.tsx` y en `AiLeadReport.tsx`:

### Comunes (todos los roles)

- Header: nombre del lead, breadcrumb, botones Editar / Guardar / Cancelar / Eliminar (según permisos).
- Tab **Datos de Entidad**: nombre, teléfono, email, rubro, dirección, web, Instagram, Facebook, etc. (edición si `canEditLead`).
- Tab **Datos nuevos del lead** (parcial): al menos vista de Website, Objetivo, “¿Ya es cliente de la Agencia?”, Tamaño, Notas de prensa, Notas; Creado/Actualizado.
- Tab **Contactos**: listado y “+ Agregar contacto” (hoy sin restricción por rol en UI).
- Vinculación a empresa (aviso “no vinculado” + vincular por ID cuando se edita).

### Comercial

- Tab **Datos nuevos del lead** completo: Estado Comercial (score, origen, etapa, comercial asignado, LinkedIn empresa/director), Datos del Lead (website, objetivo, audiencia, tamaño, oferta, notas).
- Botones de generación y exportación **comerciales** en Agente IA: “Generar Comercial”, “Informe Comercial” (PDF), “Prompt Gamma Comercial”, “Generar Gamma Comercial”.
- Perfil de informe IA **comercial** (módulos: investigación digital, redes, prestigio, posicionamiento, competencia, FODA, oportunidades, acciones, materiales, cierre, visión estratégica, plan crecimiento, propuesta EASY, oportunidades negocio EASY, LinkedIn decision makers).

### Técnico

- Botones y perfiles **técnicos** en Agente IA: “Generar Técnico”, “Informe Técnico” (PDF), “Prompt Gamma Técnico”, “Generar Gamma Técnico”.
- Perfil de informe IA **técnico** (módulos: investigación digital, redes, pauta publicitaria, posicionamiento, north star, producto estrella, auditoría técnica básica, visión estratégica).
- Módulos técnicos (north_star_metric, producto_servicio_estrella, auditoria_tecnica_basica) solo se activan si hay señal web/pauta.

### Consultor

- No hay hoy un bloque etiquetado “Consultor” en la ficha.
- En listado de leads existe la opción **“Manual”** (crear lead manual vs “Desde entidad”); no hay bloque “Neuroventas / Manual” en la ficha. Se asume que **“Neuroventas / Manual”** es un bloque futuro para el rol consultor (contenido/guía o checklist de neuroventas).

Resumen en tabla:

| Categoría  | Bloques / elementos |
|------------|----------------------|
| **Comunes** | Header, Datos de Entidad (tab), Contactos (tab), Datos del lead (vista básica), vinculación empresa. |
| **Comercial** | Estado Comercial, asignación comercial, pipeline, score; Generar/PDF/Prompt/Gamma **Comercial**; perfil IA comercial. |
| **Técnico** | Generar/PDF/Prompt/Gamma **Técnico**; perfil IA técnico y módulos técnicos. |
| **Consultor** | (Futuro) Bloque “Neuroventas / Manual”. |

---

## 3. Matriz por rol (propuesta accionable)

### ROL: comercial

- **Qué ve**  
  - Todo lo común (header, Datos de Entidad, Contactos, Datos del lead en vista básica).  
  - Tab “Datos nuevos del lead” completo (Estado Comercial, pipeline, comercial asignado, score, LinkedIn, objetivo, audiencia, tamaño, oferta, notas).  
  - Tab Agente IA con **solo** perfil comercial: chips y contenido de módulos comerciales; botones Generar Comercial, Informe Comercial (PDF), Prompt Gamma Comercial, Generar Gamma Comercial.  
  - Tab Acciones.  
  - Tab Meet Asistido (si se mantiene para todos).

- **Qué edita**  
  - Datos de Entidad y Datos del lead (si `canEditLead`: propio lead o `leads.write`).  
  - Contactos (agregar/editar).  
  - No edita asignación de comercial si se restringe a admin/operador (opcional).

- **Qué botones usa**  
  - Editar, Guardar, Cancelar.  
  - Generar Comercial, Informe Comercial (PDF), Prompt Gamma Comercial, Generar Gamma Comercial.  
  - No ve botones técnicos (Generar Técnico, Informe Técnico, Gamma Técnico).

- **Qué módulos IA usa**  
  - Los del perfil comercial en `lib/ai/reportProfiles.ts` (investigación digital, redes, prestigio, posicionamiento, competencia, FODA, oportunidades, acciones, materiales, cierre, visión estratégica, plan crecimiento, propuesta EASY, oportunidades negocio EASY, LinkedIn decision makers).

---

### ROL: tecnico

- **Qué ve**  
  - Todo lo común.  
  - Tab “Datos nuevos del lead” puede ser vista reducida o igual que comercial (a criterio; sugerencia: mismo contenido, solo lectura de etapa/comercial si no es dueño).  
  - Tab Agente IA con **solo** perfil técnico: chips y contenido de módulos técnicos; botones Generar Técnico, Informe Técnico (PDF), Prompt Gamma Técnico, Generar Gamma Técnico.  
  - Tab Acciones.  
  - Tab Meet Asistido (si aplica).

- **Qué edita**  
  - Datos de Entidad y Datos del lead si tiene `leads.write` o política equivalente (ej. “solo leads asignados a mi área”).  
  - Contactos.  
  - No necesita editar “Comercial asignado” ni etapa comercial (o solo lectura).

- **Qué botones usa**  
  - Editar, Guardar, Cancelar (si puede editar).  
  - Generar Técnico, Informe Técnico (PDF), Prompt Gamma Técnico, Generar Gamma Técnico.  
  - No ve botones comerciales (Generar Comercial, etc.).

- **Qué módulos IA usa**  
  - Los del perfil técnico en `reportProfiles.ts` (investigación digital, redes, pauta, posicionamiento, north star, producto estrella, auditoría técnica básica, visión estratégica), con gate de señal web/pauta para módulos técnicos.

---

### ROL: consultor

- **Qué ve**  
  - Todo lo común.  
  - Tab “Datos nuevos del lead” (sugerencia: vista completa en solo lectura o editable según permiso).  
  - Tab Agente IA: se puede elegir **ambos** perfiles (comercial y técnico) o solo uno; sugerencia: ambos, para armar propuestas y material de consultoría.  
  - Tab Acciones.  
  - **Bloque “Neuroventas / Manual”**: lugar natural = dentro de la ficha, por ejemplo una pestaña nueva “Consultor” o una sección colapsable bajo “Datos nuevos del lead” o bajo IA. Contenido: guía, checklist o manual de neuroventas (a definir).

- **Qué edita**  
  - Igual que comercial/técnico si tiene `leads.write`; o solo lectura y comentarios en Acciones / Neuroventas.

- **Qué botones usa**  
  - Editar, Guardar, Cancelar (si tiene permiso).  
  - Generar Comercial y Generar Técnico (y sus PDF/Gamma) si se decide que consultor ve ambos perfiles.  
  - Acceso al bloque Neuroventas / Manual (por ejemplo “Abrir manual”, “Marcar ítems”, etc.).

- **Qué módulos IA usa**  
  - Comercial y técnico (ambos perfiles) si se implementa “consultor ve todo” en IA.

- **Dónde va el bloque “Neuroventas / Manual”**  
  - Opción A: Nueva tab “Consultor” entre tabs existentes, con contenido del manual + posible checklist.  
  - Opción B: Sección colapsable “Neuroventas / Manual” al final del tab “Datos nuevos del lead” o debajo del bloque IA.  
  - Opción C: Página o modal dedicado enlazado desde un botón “Neuroventas” en el header de la ficha.

---

## 4. ¿Cómo resolverlo con la arquitectura actual?

### 4.1 Permisos por módulo

- **Hoy:** No existen permisos del tipo `leads.ia.comercial`, `leads.ia.tecnico`, `leads.tab.consultor`. Solo `leads.read` y `leads.write` (y en backend `requirePermission(req, "leads.read")` en varias rutas).
- **Propuesta:** Introducir permisos opcionales por “área” dentro de leads, por ejemplo:  
  `leads.ia.comercial`, `leads.ia.tecnico`, `leads.consultor` (o `leads.neuroventas`).  
  Así se puede en frontend y backend permitir o no el perfil comercial/técnico y el bloque consultor según rol, sin depender solo del nombre del rol.

### 4.2 Role-based rendering en frontend

- **Ventaja:** Ya tenés `role` y `hasPermission` en la ficha (`usePermissions()`). Basta condicionar por `role === "comercial"` / `"tecnico"` / `"consultor"` (o por permisos nuevos) para mostrar/ocultar tabs o botones.
- **Riesgo:** Duplicar lógica si además se usan permisos por módulo; conviene un solo criterio (solo rol **o** solo permisos) para no mezclar.

### 4.3 Tabs por rol

- **Idea:** Definir qué tabs ve cada rol. Ej.: comercial → Entidad, Lead, IA (solo comercial), Acciones, Contactos; técnico → igual pero IA solo técnico; consultor → todo + tab “Consultor” (Neuroventas/Manual).
- **Implementación:** Array de tabs filtrado por `role` (o por permisos). Ej. `const tabs = ALL_TABS.filter(t => canSeeTab(role, t.id))`.

### 4.4 Secciones colapsables por rol

- **Idea:** Mismas tabs para todos, pero dentro de “Agente IA” o “Datos del lead” algunas secciones se muestran o colapsan según rol (ej. “Solo consultor”).
- **Implementación:** Mismo patrón: `role === "consultor" && <SeccionNeuroventas />`.

**Recomendación:** Combinar **role-based rendering** en frontend (usando el `role` que ya devuelve `usePermissions`) con **tabs por rol** (lista de tabs filtrada por rol). Si más adelante se necesita flexibilidad fina (mismo rol con permisos distintos), sumar **permisos por módulo** en DB y en `PERMISSIONS_BY_ROLE` / API, y que el front siga usando `hasPermission("leads.ia.comercial")` etc. para los botones de IA y el bloque consultor.

---

## 5. Resumen final

### a) Archivos a tocar después (sin orden)

- **`app/lib/rbac.ts`**  
  - Añadir `tecnico` y `consultor` a `RoleKey` y `NORMALIZED_ROLES`.  
  - Asignar en `PERMISSIONS_BY_ROLE` permisos para tecnico y consultor (y opcionalmente `leads.ia.comercial`, `leads.ia.tecnico`, `leads.consultor`).  
  - Actualizar `PATH_ROLES` si algún rol tiene acceso distinto a `/admin/leads`.  
  - Añadir etiquetas en `ROLE_LABELS`.

- **`app/admin/leads/[id]/page.tsx`**  
  - Definir lista de tabs según rol (o permisos).  
  - Ocultar tabs que no correspondan al rol (ej. “Agente IA” solo con el perfil que toque, o tab “Consultor”).  
  - Condicionar botones de IA (Generar Comercial/Técnico, PDF, Gamma) por rol o por permiso.  
  - Reservar lugar para el bloque “Neuroventas / Manual” (nueva tab o sección) para consultor.

- **`components/leads/AiLeadReport.tsx`**  
  - Recibir `role` o `allowedProfiles` (ej. `["comercial"]` o `["tecnico"]` o `["comercial","tecnico"]`) como prop.  
  - Renderizar solo los botones y perfiles permitidos (Comercial vs Técnico) según esa prop.

- **`app/api/admin/leads/[id]/ai-report/route.ts`** y **`app/api/admin/leads/[id]/ai-report/pdf/route.ts`**  
  - (Opcional) Validar que el rol o permiso del usuario permita el `profile` (comercial/tecnico) solicitado; si no, 403.

- **`app/api/admin/leads/[id]/gamma-prompt/route.ts`** y **`app/api/admin/leads/[id]/gamma-proposal/route.ts`** (y status)  
  - (Opcional) Misma validación por `profile` según rol/permiso.

- **Tabla `roles` (Supabase)**  
  - Insertar roles `tecnico` y `consultor` si se gestionan desde DB.

- **Tabla `permissions`**  
  - Si se usan permisos por módulo: crear `leads.ia.comercial`, `leads.ia.tecnico`, `leads.consultor` (o `leads.neuroventas`).

- **`app/api/admin/permissions/me`**  
  - Sin cambios si los nuevos roles se resuelven por `roles.name` y `normalizeRole`; si se añaden permisos nuevos, ya se devuelven en `data` vía `role_permissions`.

- **Middleware**  
  - Incluir `tecnico` y `consultor` en `PATH_ROLES` para `/admin/leads` (y demás rutas que deban poder acceder).

### b) Estrategia recomendada

1. **Fase 1 – Roles y acceso a ruta**  
   Añadir `tecnico` y `consultor` en `rbac.ts` y en DB; asegurar que puedan entrar a `/admin/leads` vía `PATH_ROLES` y middleware.

2. **Fase 2 – UI por rol en la ficha**  
   - Tabs: construir la lista de pestañas en función de `role` (y luego, si se quiere, de permisos).  
   - Agente IA: pasar desde la página del lead el rol (o “qué perfiles puede usar”) a `AiLeadReport` y mostrar solo los botones/perfiles correspondientes (comercial vs técnico vs ambos).  
   - No crear aún el contenido “Neuroventas / Manual”; solo dejar el lugar (tab o sección) y mostrarla solo si `role === "consultor"`.

3. **Fase 3 – Backend**  
   Opcionalmente restringir en API de IA y Gamma el `profile` según rol (comercial solo profile comercial, técnico solo técnico, consultor ambos).

4. **Fase 4 – Consultor y Neuroventas**  
   Implementar el contenido del bloque “Neuroventas / Manual” y cualquier permiso específico (`leads.consultor` / `leads.neuroventas`).

### c) Riesgos

- **Doble fuente de verdad:** Hoy el front usa `role` de la API y además el mapa estático `PERMISSIONS_BY_ROLE` en `rbac.ts`. Si en DB se asignan permisos a un rol que no está en el mapa, `hasPermission(role, key)` puede fallar para ese key; `permissions.includes(key)` lo compensa. Mantener ambos alineados (nombres de roles y keys en DB iguales a los de `rbac.ts`).
- **Config layout:** Usa `getSession()` (legacy) y `config.admin`. Revisar que consultor/tecnico no necesiten entrar a configuración; si sí, habría que añadir lógica por permiso/rol.
- **Comercial “dueño”:** La regla `isLeadOwner` (comercial solo edita “sus” leads) está clara; para tecnico/consultor definir si aplica “dueño” por asignación o si solo `leads.write` es suficiente.

### d) Orden ideal de implementación (próximos pasos)

1. **Extender roles en código y DB:** `RoleKey` + `NORMALIZED_ROLES` + `PERMISSIONS_BY_ROLE` + `PATH_ROLES` + `ROLE_LABELS` en `rbac.ts`; inserts en `roles` (y en `permissions`/`role_permissions` si se usan permisos por módulo).  
2. **Middleware y permisos/me:** Verificar que `canAccessPath` y la API devuelvan bien `tecnico` y `consultor` para `/admin/leads`.  
3. **Ficha lead – tabs por rol:** En `[id]/page.tsx`, filtrar tabs (y opcionalmente ocultar “Meet Asistido” si no aplica).  
4. **Ficha lead – Agente IA por rol:** En `AiLeadReport`, recibir rol o perfiles permitidos y mostrar solo botones/perfiles comercial o técnico (o ambos para consultor).  
5. **APIs de IA/Gamma (opcional):** Validar `profile` según rol en POST/GET.  
6. **Bloque Consultor / Neuroventas:** Añadir tab o sección y contenido cuando se defina el manual.

---

**Documento generado a partir del análisis del código. No se ha modificado código, seeds, login ni usuarios.**
