# Auditoría integral LEADS87 — Versión final y única del sistema comercial

**Fecha:** Marzo 2026  
**Alcance:** Rutas `/admin/leads`, `/admin/leadsok`, `/admin/oportunidades`, `/admin/leads87`, `/admin/leads87/[id]`  
**Objetivo:** Diagnóstico crítico para decidir si LEADS87 puede reemplazar por completo a Leads, LeadsOK y Oportunidades. Sin implementar cambios, sin tocar backend, sin modificar UI.

---

## 1. Resumen ejecutivo

LEADS87 consolida el flujo macro (8 etapas), micro (6 pasos), workspace con AiLeadReport e iframes, bloque Reportes y documentos, ficha del lead desplegable con **edición inline** (empresa, contacto, email, teléfono, web, rubro, LinkedIn, origen, objetivo, audiencia, tamaño), barra de progreso del proceso comercial, mensaje de transición paso 1→2, y CTA principal que en caso de faltantes lleva a **completar datos aquí** (ficha en la misma pantalla).  

Aun así, **no está listo** para ser la única pantalla: faltan métricas en listado, filtro "Solo mis leads", kanban con drag & drop, score comercial y lectura CRM en el detalle, y claridad sobre si el workspace de pasos 4–6 (iframe a `/admin/leads/[id]`) cuenta como “misma pantalla” o abandono de LEADS87. La existencia de cuatro rutas (Leads, LeadsOK, Oportunidades, LEADS87) y un selector que mezcla “Lista”/“Kanban” (que llevan a otras rutas) con la vista LEADS87 en la misma página genera **duplicación y confusión**. La recomendación es **CASI LISTO**: cerrar los gaps de listado y orientación, y luego declarar LEADS87 como definitivo y deprecar las otras tres.

---

## 2. Qué ya está bien resuelto

| Área | Evidencia |
|------|-----------|
| **Flujo macro 1–8** | `getLeadsOkMacroFlow`: 8 etapas sin etapa 0, checklist solo en etapa 1, colores completed (verde) / active (amarillo/emerald) / pending (gris). "Qué hacemos" / "Qué obtengo" en etapa 2. |
| **Flujo micro 6 pasos** | `getLeadsOkMicroFlow`: un solo paso activo, pendientes con mensaje "Primero completa el paso anterior", CTA por paso, mensaje "Paso 1 completado. Se habilitó Diagnóstico comercial" en paso 2 activo. |
| **Orientación** | Bloque "Siguiente acción recomendada" con etapa macro, paso micro y **un solo CTA** (verde cuando no hay bloqueo: siguiente acción; gris cuando hay bloqueo: "Completar datos aquí"). Lista de faltantes cuando hay bloqueo. |
| **Progreso** | Barra "Progreso del proceso comercial" con % y "X de 8 etapas completadas", etapa actual. |
| **Ficha del lead** | Cabezal con nombre clickeable que abre/cierra ficha; ficha con empresa, contacto, email, teléfono, rubro, web, LinkedIn, origen, objetivo, responsable, pipeline. **Edición inline** con formulario completo (incl. RubroSelect, origen, objetivos, audiencia, tamano) y Guardar/Cancelar; pipeline y responsable solo informativos con texto "solo se editan en Oportunidades". |
| **Datos faltantes sin salir** | Si hay bloqueo por faltantes, el botón principal es "Completar datos aquí" → abre ficha y pasa a modo edición + scroll a la ficha (`goToFichaAndEdit`). No redirige a Oportunidades. |
| **Workspace paso activo** | Pasos 1–3: `AiLeadReport` con generación, `onReportGenerated`, refetch. Pasos 4–6: iframe a `getWorkspaceFrameSrc` (presentación, consultor servicios/propuesta-export, comercial ia-report-block). |
| **Reportes y documentos** | Bloque con: Informe comercial (Generado/No generado, "Ir a ver informe", "Ir a ver / descargar PDF", o Bloqueado con candado + tooltip); Gamma comercial (Listo/Abrir Gamma o Bloqueado); Diagnóstico/Estrategia/Propuesta ("Ir al workspace (diagnóstico / estrategia / propuesta)"). Textos honestos (navegar vs descargar). |
| **Listado** | Tabla con Empresa/Lead, Salud, % avance, Etapa actual, Estado (Completo/Activo/Bloqueado/Nuevo), Acción/Abrir. Filtro pipeline, buscador. Toggle Listado/Kanban en la misma página. Link "Nuevo lead" → `/admin/leads/nuevo`. |
| **Guía estratégica** | `GuiaEstrategicaProceso` al final con etapas colapsables, Objetivo, Checklist, Tip, Error común. |
| **Reglas visuales** | Verde (emerald) siguiente acción; amarillo/amber activo; naranja pendiente; gris candado bloqueado; estados en listado con colores (verde completo, amber activo, rojo bloqueado, slate nuevo). |

---

## 3. Qué falta migrar

| Estado | Origen | Área | Hallazgo | Acción recomendada |
|--------|--------|------|----------|---------------------|
| **Falta** | Oportunidades | Listado | **Métricas superiores**: Oportunidades muestra "Oportunidades activas", "En propuesta", "En seguimiento", "Nuevas". LEADS87 no tiene ningún bloque de métricas agregadas. | Añadir en `app/admin/leads87/page.tsx` un bloque de 4 métricas (activas, en propuesta, en seguimiento, nuevas) calculadas sobre `filteredLeads`. |
| **Falta** | Oportunidades | Listado | **"Solo mis leads"**: Oportunidades tiene checkbox que filtra por responsable; en LEADS87 `onlyMine` no existe y el listado no expone filtro por comercial. | Añadir checkbox "Solo mis leads" y filtrar por `comercial_id` si la API de listado devuelve ese campo (o documentar limitación si no). |
| **Falta** | Oportunidades | Listado | **Kanban con drag & drop**: En Oportunidades las tarjetas se arrastran a otra columna y se hace PATCH pipeline. En LEADS87 el kanban es solo visual con links a `/admin/leads87/[id]`, sin arrastre. | Implementar drag & drop en el kanban de LEADS87 y PATCH `/api/admin/leads/:id` con `pipeline` al soltar, o documentar como fase posterior. |
| **Falta** | Oportunidades | Detalle | **Score comercial y Lectura automática del CRM**: OportunidadWorkspace (tab Contexto) tiene "Score comercial" y "Lectura automática del CRM". LEADS87 no muestra score ni lectura CRM en ninguna parte. | Incluir bloque Score comercial (y opcionalmente lectura CRM) en LEADS87 [id], por ejemplo en cabezal o dentro del primer paso / ficha. |
| **Falta** | Leads | Listado | **Acciones masivas y pipelines desde API**: Leads tiene selección múltiple, cambio masivo de pipeline, eliminación masiva, export CSV, pipelines cargados desde `/api/admin/leads/pipelines`. LEADS87 no tiene bulk ni export ni pipelines dinámicos. | Decidir si LEADS87 debe tener bulk/export; si sí, migrar. Pipelines: LEADS87 usa columnas fijas; opcional usar API de pipelines para columnas. |
| **Falta** | Leads | Listado | **Nuevo lead desde entidad**: Leads tiene "Nuevo lead" con opción "Desde entidad" (selector de empresas). LEADS87 solo enlaza a `/admin/leads/nuevo` (manual). | Si se quiere paridad, añadir en LEADS87 flujo "Nuevo lead" con opción desde entidad o enlazar a la misma modal/ruta que Leads. |

---

## 4. Qué está inconsistente o confuso

| Estado | Origen | Área | Hallazgo | Acción recomendada |
|--------|--------|------|----------|---------------------|
| **Inconsistente** | Navegación | Listado | **Selector Lista / Kanban / LEADS87**: En la misma página LEADS87 hay un bloque con tres links: "Lista" → `/admin/leads`, "Kanban" → `/admin/leads/kanban`, "LEADS87" → `/admin/leads87`. Pero debajo, en la misma página, ya hay toggle "Listado" / "Kanban" y la tabla/kanban de LEADS87. El usuario puede pensar que "Lista" y "Kanban" son vistas de LEADS87 cuando en realidad son **otras rutas**. | Unificar: o bien quitar los links a Leads y Leads/kanban y dejar solo el toggle local, o bien etiquetar explícitamente "Lista (Leads clásico)" y "Kanban (Leads clásico)" y dejar "LEADS87" como vista actual. Idealmente, cuando LEADS87 sea definitivo, eliminar enlaces a las otras rutas. |
| **Inconsistente** | CTA | Orientación | **Color del CTA principal con bloqueo**: La regla "verde = siguiente acción principal" se cumple cuando no hay bloqueo. Cuando hay bloqueo, el único CTA es "Completar datos aquí" con `bg-slate-800` (gris). No hay CTA verde en ese estado. | Documentar que el CTA de desbloqueo es gris como acción correctiva, o unificar en verde el CTA principal siempre que sea la única acción recomendada. |
| **Inconsistente** | Macro | Visual | **Solo etapa 2 tiene "Qué hacemos" / "Qué obtengo"** en las tarjetas macro. Las otras 7 no. | Confirmar si es decisión de producto; si se desea paridad con más etapas, extender. |
| **Inconsistente** | Listado | Estado | **Estado "bloqueado" (rojo) nunca se asigna**: `getLeadEstadoVisual` en LEADS87 devuelve solo `finalizado`, `en_curso`, `nuevo`. La rama `bloqueado` existe en estilos pero no se usa. | Definir criterio (ej. lead sin datos mínimos o etapa bloqueada) y asignar `bloqueado` en ese caso; si no se usará, quitar de UI para no confundir. |
| **Confuso** | Workspace | Detalle | **Pasos 4–6: iframe a `/admin/leads/[id]`**: El contenido de los pasos 4 (estructura de servicios), 5 (propuesta) y 6 (presentación) es un iframe que carga la ruta de **Leads** (tabs Comercial/Consultor, etc.). El usuario sigue en la URL `/admin/leads87/[id]` pero la experiencia es la de la pantalla de Leads. No hay un único "workspace LEADS87" para esos pasos. | Documentar que pasos 4–6 reutilizan la vista Leads; a largo plazo, decidir si se migra ese contenido a componentes dentro de LEADS87 o se mantiene iframe. |
| **Confuso** | Reportes | Detalle | **"Ir al workspace (diagnóstico / estrategia / propuesta)"**: Un solo botón para tres tipos de documento; el usuario no sabe si va a diagnóstico, estrategia o propuesta. El workspace que abre es el paso 2 (diagnóstico). | Aclarar en el label o desglosar en tres acciones (Ir a diagnóstico, Ir a estrategia, Ir a propuesta) que lleven al paso correspondiente. |

---

## 5. Qué hace que el usuario se pierda

| Riesgo | Evidencia | Impacto |
|--------|-----------|---------|
| **Cuatro rutas sin jerarquía** | Leads, LeadsOK, Oportunidades y LEADS87 coexisten. El menú o navegación no indican que LEADS87 es "el" flujo definitivo. El usuario no sabe si debe usar Leads, Oportunidades o LEADS87 para abrir una oportunidad. | Alto: fragmentación y doble trabajo. |
| **Selector Lista/Kanban/LEADS87** | En la página LEADS87, "Lista" y "Kanban" llevan a otras rutas. Quien hace clic puede no darse cuenta de que salió de LEADS87. | Medio: pérdida de contexto. |
| **Sin "Cambiar lead" en detalle** | En LEADS87 [id] no hay dropdown para elegir otro lead sin volver al listado. LeadsOK sí tiene "Lead de prueba" (dropdown) en la misma página. | Bajo: más clics para cambiar de lead. |
| **Pipeline y responsable no editables** | La ficha dice "Pipeline y responsable solo se editan en Oportunidades". El usuario que quiera cambiar etapa o asignación debe ir a Oportunidades; no hay indicación clara de cómo llegar ni por qué está separado. | Medio: fricción y sensación de sistema partido. |
| **Workspace 4–6 en iframe** | Al expandir paso 4, 5 o 6, el iframe muestra la interfaz de Leads (tabs, secciones). Quien no conozca Leads puede no entender que eso sigue siendo "el workspace del paso activo" de LEADS87. | Medio: sensación de salir del flujo. |
| **% avance en listado aproximado** | El % se calcula sin datos de documentos (diagnóstico, estrategia, propuesta); etapas 3, 4, 6, 7 no se completan en la fórmula. El número puede no coincidir con la realidad. | Bajo: desconfianza en el indicador si se nota. |

---

## 6. Top 10 hallazgos críticos priorizados

| # | Hallazgo | Estado | Origen | Área | Impacto | Acción recomendada |
|---|----------|--------|--------|------|---------|---------------------|
| 1 | **Cuatro rutas sin declarar LEADS87 como definitiva** | Riesgo | Todos | UX | Alto | Redirigir Leads, LeadsOK y Oportunidades a LEADS87 (o a un hub "Comercial" que sea LEADS87) y/o mostrar mensaje tipo "Sistema comercial unificado: LEADS87". |
| 2 | **Selector Lista/Kanban/LEADS87 confunde** (Lista y Kanban llevan a otras rutas) | Parcial | LEADS87 | Listado | Alto | Quitar links a Leads y Leads/kanban de la página LEADS87 o etiquetarlos como "Leads clásico"; priorizar toggle Listado/Kanban local. |
| 3 | **Sin métricas en listado** (activas, en propuesta, en seguimiento, nuevas) | Falta | Oportunidades | Listado | Medio | Añadir bloque de 4 métricas en `leads87/page.tsx` calculadas sobre `filteredLeads`. |
| 4 | **Kanban sin drag & drop** | Falta | Oportunidades | Listado | Medio | Implementar drag & drop y PATCH pipeline en kanban LEADS87 o documentar como siguiente fase. |
| 5 | **Sin "Solo mis leads"** | Falta | Oportunidades | Listado | Medio | Añadir checkbox y filtrar por comercial si el API lo permite. |
| 6 | **Score comercial y Lectura CRM no visibles en LEADS87** | Falta | Oportunidades | Detalle | Medio | Añadir bloque Score (y lectura CRM si aplica) en cabezal o ficha de LEADS87 [id]. |
| 7 | **CTA principal gris cuando hay bloqueo** | Parcial | LEADS87 | UX | Bajo | Unificar en verde el CTA principal o documentar regla "gris = desbloqueo". |
| 8 | **Estado "bloqueado" en listado nunca usado** | Parcial | LEADS87 | Listado | Bajo | Asignar estado bloqueado con criterio claro o eliminar de la UI. |
| 9 | **Pasos 4–6 en iframe (Leads)** | Parcial | LEADS87 | Workspace | Medio | Documentar; a largo plazo migrar contenido a LEADS87 o mantener iframe con mensaje de contexto. |
| 10 | **Pipeline y responsable solo en Oportunidades** | Parcial | Oportunidades | Detalle | Medio | Incluir en LEADS87 edición de pipeline y responsable (y quitar dependencia de Oportunidades) o dejar explícito con link "Abrir en Oportunidades para cambiar etapa/asignación". |

---

## 7. Criterios de auditoría (respuestas con evidencia)

### 1. Orientación del usuario

- **¿Entiende en qué etapa está?** Sí: stepper 8 etapas, bloque "Siguiente acción" con "Etapa macro" y "Paso micro", barra de progreso con "Etapa actual".
- **¿Entiende qué paso está activo?** Sí: flujo micro con un paso `active`, details abierto y CTA "Ir a…" del paso.
- **¿Entiende qué le falta para avanzar?** Sí cuando hay bloqueo: lista de ítems del checklist no cumplidos y botón "Completar datos aquí" que lleva a la ficha editable.
- **¿Existe siempre un único CTA principal verde?** No cuando hay bloqueo: el CTA principal es "Completar datos aquí" (gris). Cuando no hay bloqueo, sí hay un solo botón verde (siguiente acción).
- **¿Hay algún momento donde el usuario pueda perderse?** Sí: al usar el selector que lleva a Leads o Leads/kanban; al no ver score/lectura CRM; al no poder editar pipeline/responsable sin ir a Oportunidades.

### 2. Consolidación de las 3 versiones anteriores

- **Qué tomó LEADS87:** De LeadsOk: flujo macro/micro, workspace AiLeadReport, iframes 4–6, reportGeneratedLocally. De Oportunidades: stepper, guía estratégica, bloques del análisis, listado con filtros y columnas Salud/%/Etapa/Estado, barra de progreso (añadida después), ficha desplegable y edición inline (añadida). De Leads: link a nuevo lead y uso del mismo workspace (iframe) para pasos 4–6.
- **Qué no tomó:** Métricas superiores, "Solo mis leads", kanban drag & drop, score comercial y lectura CRM, tabs Contexto/Investigación/…, bulk y export de Leads, pipelines dinámicos, "Nuevo lead desde entidad".
- **Qué tomó a medias:** Reportes y documentos (bloque existe; pasos 4–6 y diagnóstico/estrategia/propuesta con un solo botón genérico). % avance (fórmula sin documents). Estado bloqueado (definido pero no asignado).
- **Qué sigue peor resuelto:** Gestión de cartera (métricas, filtro por responsable, kanban operativo) y visibilidad de score/calidad del lead en el detalle.

### 3. Gestión de cartera (LEADS87)

- **Listado:** OK (columnas, filtro pipeline, buscador, link Abrir).
- **Kanban:** Parcial (columnas y links OK; sin drag & drop).
- **Filtros:** OK (pipeline, buscador); falta "Solo mis leads".
- **Buscador:** OK (empresa, contacto, email).
- **Abrir oportunidad:** OK (dropdown + "Abrir en LEADS87" y filas con link a `/admin/leads87/[id]`).
- **Nuevo lead:** OK (link a `/admin/leads/nuevo`); falta opción "Desde entidad".
- **Métricas superiores:** Falta.
- **Salud del lead:** OK (badge en listado).
- **% avance:** OK (columna); valor aproximado sin documents.
- **Etapa actual:** OK.
- **Estado finalizado/en curso/bloqueado:** Parcial (finalizado y en curso OK; bloqueado no se asigna).

### 4. Detalle del lead

- **Cabezal:** OK (nombre clickeable, breadcrumb LEADS87).
- **Ficha del lead:** OK (desplegable, vista y edición inline con todos los campos pedidos).
- **Edición de datos:** OK (empresa, contacto, email, teléfono, web, rubro, LinkedIn, origen, objetivo, audiencia, tamaño); pipeline y responsable solo lectura con mensaje.
- **Responsable:** Visible en ficha; no editable en LEADS87.
- **Pipeline:** Visible en ficha; no editable en LEADS87.
- **Contexto mínimo:** OK (ficha con todos los campos).
- **Resolver faltantes sin salir:** OK ("Completar datos aquí" → ficha en edición en la misma pantalla).

### 5. Flujo macro

- **Etapas 1–8, sin etapa 0:** OK.
- **Colores:** OK (completado verde, activo emerald/amber, pendiente gris).
- **Consistencia de estados:** OK.
- **Qué hacemos / qué obtengo:** OK en etapa 2; solo informativo en el resto.
- **Claridad del paso siguiente:** OK (bloque "Siguiente acción" y CTA único).

### 6. Flujo micro

- **Un solo paso activo:** OK.
- **Pasos futuros bloqueados/pendientes:** OK (mensaje "Primero completa el paso anterior").
- **Mensajes claros:** OK (transición paso 1→2, "Qué obtiene" por paso).
- **CTA del paso activo:** OK (botón "Ir a…" por paso).
- **Transición al siguiente:** OK (lógica por datos; no hay "siguiente" explícito, se avanza completando en el workspace).

### 7. Workspace del paso activo (auditoría dura)

- **¿Se entiende qué hacer?** Sí para pasos 1–3 (AiLeadReport con título y helper). Para 4–6, el iframe muestra la UI de Leads; puede no ser obvio que eso es "el paso activo".
- **¿Se entiende qué se obtiene?** Sí ("Qué obtiene" en cada paso y en el bloque siguiente acción).
- **¿Se entiende qué falta?** Sí en etapa 1 (checklist en macro); en pasos 4–6 la lógica está dentro del iframe.
- **¿Hay un único botón verde?** Sí en pasos 1–3 (generar / ir a diagnóstico, etc.); en el bloque superior hay un solo CTA verde cuando no hay bloqueo.
- **¿Procesos largos con barra/progreso/tiempo estimado?** Sí en AiLeadReport (progreso y tiempo estimado para Gamma).
- **¿Completar lo que falta sin salir del flujo?** Parcial: datos del lead sí (ficha en LEADS87); pasos 4–6 se completan dentro del iframe de Leads, por lo que "no salir" es en URL pero la experiencia es otra pantalla.

### 8. Motor IA

- **Generación del análisis:** OK (AiLeadReport, paso 1).
- **Módulos:** OK (perfil comercial, pasos 2–3 con mismo componente).
- **Progreso global:** OK (barra en AiLeadReport).
- **Progreso por módulo:** En el componente sí; en LEADS87 no hay desglose por módulo fuera del iframe.
- **Tiempo estimado:** OK (AiLeadReport muestra tiempo estimado restante).
- **Regeneración:** OK ("Ir al workspace para regenerar análisis" en paso 1 completado).
- **Personalización IA:** En AiLeadReport; no expuesta como bloque aparte en LEADS87.
- **Claridad de salidas:** OK en bloque Reportes y documentos (Informe, PDF, Gamma, Diagnóstico/Estrategia/Propuesta).

### 9. Reportes y documentos

- **Informe comercial:** OK (estado Generado/No generado, Ir a ver informe, Ir a ver/descargar PDF, Bloqueado con candado y tooltip).
- **PDF:** OK (texto "Ir a ver / descargar PDF", navegación al workspace).
- **Gamma:** OK (Listo/Abrir Gamma o Bloqueado).
- **Estados bloqueado/disponible:** OK (opacity, cursor-not-allowed, candado, tooltip "Completa el paso anterior para desbloquear").
- **Coherencia navegación/acción:** OK (botones que navegan dicen "Ir a…"; no se ejecuta generación/descarga en el bloque).
- **Usuario entiende qué existe y qué no:** OK (badges Generado/No generado, Listo, Bloqueado).

### 10. Reglas visuales globales

- **Verde = siguiente acción principal:** Cumplido cuando no hay bloqueo; cuando hay bloqueo el CTA principal es gris.
- **Amarillo = activo:** OK (stepper, listado estado Activo).
- **Naranja = pendiente:** OK (stepper).
- **Rojo = error/bloqueo:** Definido en listado pero estado "bloqueado" nunca se asigna.
- **Gris + candado = no disponible:** OK (reportes bloqueados).
- **Nunca más de un CTA protagonista:** OK (un solo botón principal en siguiente acción y en cada paso activo).

### 11. Experiencia final

- **¿LEADS87 ya puede reemplazar a Leads, LeadsOK y Oportunidades?** No del todo: faltan métricas, "Solo mis leads", kanban drag & drop, score/lectura CRM, y claridad de que LEADS87 es la ruta única (y eliminación o redirección de las otras).
- **¿Qué impide apagar las otras 3?** (1) Uso de iframe a Leads para pasos 4–6; (2) edición de pipeline y responsable solo en Oportunidades; (3) listado con métricas y filtro "Solo mis leads" solo en Oportunidades; (4) kanban operativo solo en Oportunidades; (5) riesgo de usuarios que sigan entrando por Leads u Oportunidades por costumbre o enlaces.
- **Los 5 problemas más peligrosos hoy:** (1) Cuatro rutas sin jerarquía clara. (2) Selector Lista/Kanban que saca de LEADS87. (3) Sin métricas en listado. (4) Pipeline/responsable solo en Oportunidades. (5) Pasos 4–6 dependientes del iframe de Leads sin mensaje de contexto.
- **Las 5 mejoras que dejarían LEADS87 listo para producción:** (1) Declarar LEADS87 como sistema definitivo y redirigir o deprecar Leads, LeadsOK y Oportunidades. (2) Añadir métricas y "Solo mis leads" en listado. (3) Unificar selector (quitar o etiquetar links a otras rutas). (4) Incluir score comercial (y opcionalmente lectura CRM) en el detalle. (5) Kanban con drag & drop o mensaje claro de que el cambio de etapa se hace en el detalle.

---

## 8. Recomendación final

**Recomendación:** **CASI LISTO** para reemplazar las otras 3 pantallas.

- **LISTO:** Flujo macro/micro, orientación, ficha y edición inline, datos faltantes resueltos en LEADS87, reportes y documentos, barra de progreso, guía estratégica, listado con columnas y filtros básicos, reglas visuales en su mayoría.
- **Pendiente para declarar definitivo:** (1) Métricas en listado, (2) "Solo mis leads", (3) Claridad/uniﬁcación del selector y de la jerarquía de rutas, (4) Score comercial (y opcional lectura CRM) en detalle, (5) Kanban con drag & drop o decisión explícita de no tenerlo.
- **No bloqueante pero recomendable:** Edición de pipeline y responsable en LEADS87 (o flujo claro a Oportunidades solo para eso), estado "bloqueado" con criterio o retirada de la UI, y mensaje de contexto cuando el workspace sea el iframe de Leads (pasos 4–6).

Con los 5 pendientes cerrados y la decisión de rutas (redirecciones o hub), LEADS87 puede ser la **única** pantalla del sistema comercial y apagar Leads, LeadsOK y Oportunidades.
