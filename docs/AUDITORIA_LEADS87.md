# Auditoría LEADS87 vs Leads, LeadsOk y Oportunidades

**Objetivo:** Radiografía exacta de qué está migrado, qué falta y qué está incompleto o duplicado en LEADS87.  
**Alcance:** Comparación de las 4 rutas sin implementar cambios ni tocar backend.

---

## A. LO QUE YA QUEDÓ BIEN MIGRADO A LEADS87

| Elemento | Origen | Área | Notas |
|----------|--------|------|--------|
| Flujo macro 8 etapas (1–8, sin etapa 0) | LeadsOk / Oportunidades | Macro | getLeadsOkMacroFlow, tarjetas con checklist, resultado, colores completed/active/pending |
| "Qué hacemos" / "Qué obtengo" en Etapa 2 | LeadsOk | Macro | Incluido en la tarjeta de Investigación |
| Flujo micro 6 pasos colapsables | LeadsOk | Micro | getLeadsOkMicroFlow, details, paso activo, pending con mensaje "Primero completa el paso anterior" |
| Workspace del paso activo con AiLeadReport (pasos 1–3) | LeadsOk | Workspace | Mismo componente, onReportGenerated, refetchLead |
| Iframes pasos 4–6 (servicios, propuesta, presentación) | LeadsOk | Workspace | getWorkspaceFrameSrc idéntico |
| Guía estratégica del proceso (8 etapas colapsables) | Oportunidades | Guía | Componente GuiaEstrategicaProceso con contenido validado (Objetivo, Checklist, Tip, Error común) |
| Bloques del análisis comercial (4 áreas) | Oportunidades | Workspace | Investigación, Diagnóstico, Estrategia, Conversión con ítems correctos |
| Stepper horizontal 8 etapas | Oportunidades | Header | Lead → … → Cierre, colores verde/amarillo/naranja |
| Bloque "Siguiente acción recomendada" con bloqueo | LeadsOk / Oportunidades | Orientación | hasBlocking, lista de faltantes, CTA "Completar datos" o nextAction |
| CTA único verde en siguiente acción | LeadsOk | Orientación | Un solo botón principal (emerald), deshabilitado si completo |
| Selector Lista / Kanban / Ficha | LeadsOk / Oportunidades | Listado | Links a Leads, Leads/kanban, LEADS87 |
| Filtro por pipeline y buscador | Oportunidades | Listado | Misma lógica, sin tocar backend |
| Bloque "Abrir oportunidad" (dropdown + botón) | Oportunidades | Listado | "Abrir en LEADS87" |
| Botón "Nuevo lead" | Oportunidades | Listado | Link a /admin/leads/nuevo |
| Listado con columnas operativas | LEADS87 (añadido) | Listado | Salud, % avance, Etapa actual, Estado, Acción/Abrir |
| reportGeneratedLocally + effectiveLead | LeadsOk | IA | Refetch y estado local tras generar análisis |

---

## B. LO QUE FALTA MIGRAR

| Estado | Origen | Área | Hallazgo | Acción recomendada |
|--------|--------|------|----------|---------------------|
| **Falta** | Oportunidades | Listado | **Métricas superiores**: Oportunidades tiene "Oportunidades activas", "En propuesta", "En seguimiento", "Nuevas". LEADS87 no muestra ninguna métrica agregada. | Añadir bloque de 4 métricas (activas, en propuesta, en seguimiento, nuevas) encima o debajo de filtros en LEADS87 list. |
| **Falta** | Oportunidades | Listado | **"Solo mis leads"**: checkbox de filtro por responsable. LEADS87 no tiene filtro por comercial/responsable. | Añadir checkbox "Solo mis leads" y filtrar por comercial_id si el listado lo devuelve. |
| **Falta** | Oportunidades | Kanban | **Kanban con drag & drop**: En Oportunidades se puede arrastrar la tarjeta a otra columna y se actualiza pipeline vía PATCH. En LEADS87 el kanban es solo visual con links, sin arrastre. | Implementar drag & drop en LEADS87 kanban y PATCH pipeline (o documentar que se deja para fase posterior). |
| **Falta** | Oportunidades | Header (detalle) | **Ficha del lead desplegable**: En Oportunidades [id] el nombre del lead es un botón que abre/cierra una ficha con datos (empresa, contacto, email, teléfono, rubro, web, LinkedIn) y modo edición (Guardar/Cancelar). LEADS87 [id] solo muestra título "LEADS87 — {nombre}" sin ficha expandible ni edición rápida. | Añadir cabezal con ficha desplegable (y edición inline o link a edición) en LEADS87 [id]. |
| **Falta** | Oportunidades | Header (detalle) | **Responsable / Comercial**: Oportunidades puede mostrar comercial asignado; LEADS87 no muestra responsable en el cabezal. | Mostrar comercial/responsable en el header del detalle si el lead trae comercial_id/comerciales. |
| **Falta** | Oportunidades | Header (detalle) | **Pipeline explícito en cabezal**: En Oportunidades se ve pipeline; en LEADS87 solo etapa derivada en "Siguiente acción", no pipeline crudo en header. | Añadir línea opcional "Pipeline: {pipeline}" o "Etapa: {etapa}" en el header del detalle. |
| **Falta** | LeadsOk | Macro | **Barra "Progreso del proceso comercial"**: LeadsOk tiene un bloque con barra de progreso (%), "X de 8 etapas completadas" y "Etapa actual: {label}". LEADS87 no tiene esta barra resumida. | Añadir bloque de progreso (barra + porcentaje + etapa actual) entre "Siguiente acción" y "Flujo macro" en LEADS87 [id]. |
| **Falta** | Oportunidades | Reportes | **Bloque "Reportes y documentos"**: OportunidadWorkspace tiene sección con 4 documentos (Informe investigación, Diagnóstico comercial, Plan estratégico, Propuesta comercial), estado por documento (No iniciado, Borrador, Listo, etc.) y acciones Ver/Editar/Exportar PDF/Compartir. LEADS87 no tiene este bloque. | Añadir bloque "Reportes y documentos" en LEADS87 [id] (estados derivados de documents/lead y enlaces a vistas o AiLeadReport). |
| **Falta** | Oportunidades | Workspace | **Tabs Contexto / Investigación / Diagnóstico / Estrategia / Servicios / Propuesta**: Oportunidades usa workspace por pestañas con contenido por etapa (Contexto con datos del lead, score, lectura CRM; Investigación con informe; etc.). LEADS87 usa solo "Workspace del paso activo" con un único contenido (AiLeadReport o iframe). No hay tab "Contexto" con datos del lead ni score comercial en LEADS87. | Decidir si LEADS87 debe tener pestañas tipo OportunidadWorkspace o si el flujo micro + un solo workspace es la decisión definitiva; si se quiere paridad, añadir tab Contexto (datos, score, lectura CRM) y alinear resto. |
| **Falta** | Oportunidades | Workspace | **Score comercial y "Lectura automática del CRM"**: En OportunidadWorkspace (tab Contexto) hay bloque "Score comercial" (número, estado, recomendaciones) y "Lectura automática del CRM" (pendiente/placeholder según analysisVersion). LEADS87 no muestra score ni lectura automática. | Incluir bloque Score comercial y Lectura automática en LEADS87 (por ejemplo dentro del primer paso o en un panel lateral/cabezal). |
| **Falta** | Oportunidades | Workspace | **Edición inline de datos del lead en Contexto**: En Oportunidades se puede editar lead dentro de la tab Contexto (Editar → Guardar/Cancelar, RubroSelect, etc.). En LEADS87 no hay edición de lead en la vista detalle. | Añadir edición inline (o acceso rápido a ficha) en LEADS87 para completar datos sin salir. |
| **Falta** | Oportunidades | Orientación | **"Ir al workspace" / "Ir a investigación" / "Completar datos" con scroll a tab**: Oportunidades usa refs (focusContextoRef, focusInvestigacionRef, focusWorkspaceStageRef) para scroll y apertura de tab. LEADS87 tiene goToWorkspace(stepId) que abre el details y hace scroll al workspace; no hay tabs, por lo que el equivalente está cubierto de forma distinta. Si se añaden tabs, haría falta el mismo patrón de scroll. | Si se incorporan tabs en LEADS87, replicar refs y scroll a la tab correcta. |

---

## C. LO QUE ESTÁ MIGRADO PERO INCOMPLETO

| Estado | Origen | Área | Hallazgo | Acción recomendada |
|--------|--------|------|----------|---------------------|
| **Parcial** | LeadsOk / Oportunidades | Listado | **% avance en listado**: LEADS87 calcula avance con datos limitados (sin documents en listado). Etapas 3, 4, 6, 7 siempre "no completadas" en la fórmula, por lo que el % puede ser 0, 25, 50, 75, 100 pero no refleja diagnóstico/estrategia/propuesta real. | Dejar como está (aproximación sin backend) o documentar limitación; opcional: en futura fase, enriquecer listado con flags si el API lo permite. |
| **Parcial** | Todos | Workspace | **Motor IA (AiLeadReport)**: Generación, módulos, progreso, Gamma, PDF y prompts están en AiLeadReport. LEADS87 lo usa para pasos 1–3. Lo que falta en LEADS87 es la **ubicación** del resultado (Ver informe, PDF, Gamma) en un bloque dedicado "Reportes y documentos" y la visibilidad de "Informe comercial" / "Exportaciones" fuera del iframe. | Mantener AiLeadReport; añadir en LEADS87 bloque que resuma "Informe generado" / "PDF" / "Gamma" con enlaces o botones que abran/scroll al workspace o a la sección correcta de AiLeadReport. |
| **Parcial** | Oportunidades | Guía | **Guía estratégica**: Está presente y completa en LEADS87. Falta solo **posición**: en OportunidadWorkspace va al final del workspace (después de Reportes y documentos). En LEADS87 va después del workspace; si se añade "Reportes y documentos", la guía debería quedar después de ese bloque para no competir con el flujo. | Verificar orden: Siguiente acción → (Progreso bar) → Macro → Bloques análisis → Micro + Workspace → Reportes y documentos → Guía estratégica. |
| **Parcial** | LeadsOk | Micro | **Mensaje de transición "Paso 1 completado. Se habilitó Diagnóstico comercial"**: En LeadsOk se muestra cuando el paso 2 está activo. En LEADS87 no está ese mensaje explícito en el paso 2. | Añadir en LEADS87, dentro del step 2 activo, el mensaje breve de transición. |
| **Parcial** | Reglas visuales | Global | **Estado "bloqueado" (rojo)**: La regla existe en LEADS87 (getLeadEstadoVisual devuelve "bloqueado") pero nunca se asigna (solo finalizado, en_curso, nuevo). Oportunidades tiene isStageBlockedOrError para error en stepper. | Definir en qué casos marcar estado bloqueado/error (ej. lead sin empresa, o checklist crítico fallido) y aplicar en listado y/o stepper. |

---

## D. LO QUE ESTÁ DUPLICADO O INCONSISTENTE

| Estado | Origen | Área | Hallazgo | Acción recomendada |
|--------|--------|------|----------|---------------------|
| **Inconsistente** | Varios | CTA | **Color del CTA principal**: En "Siguiente acción recomendada", cuando hay bloqueo el botón es "Completar datos del paso actual" con clase bg-slate-800 (gris oscuro). Cuando no hay bloqueo es bg-emerald-600 (verde). La regla "verde = siguiente acción principal" queda cumplida solo cuando no hay bloqueo; con bloqueo el CTA principal es gris. En Oportunidades "Completar datos" e "Ir a investigación" son también slate-800. | Documentar: CTA de "desbloqueo" puede ser gris (acción correctiva); CTA de "avance" en verde. O unificar en verde el CTA principal siempre que sea la acción única recomendada. |
| **Duplicado** | Navegación | Listado | **Tres rutas de listado**: Leads, Oportunidades y LEADS87 tienen listado con filtros y tabla/kanban. LEADS87 es la versión que debe consolidar; mientras existan las tres, el usuario puede no saber si usar "Leads", "Oportunidades" o "LEADS87". | Hasta deprecar Leads/Oportunidades, mantener; al cerrar migración, redirigir Leads y Oportunidades a LEADS87 o a una sola entrada "Comercial" que sea LEADS87. |
| **Inconsistente** | LeadsOk vs LEADS87 | Orientación | **Lead selector**: En LeadsOk el selector es "Lead de prueba" (dropdown). En LEADS87 listado es tabla con "Abrir"; en detalle se llega por URL. No hay selector "elegir otro lead" dentro del detalle LEADS87 sin volver al listado. | Opcional: en LEADS87 [id] añadir dropdown "Cambiar lead" que redirija a /admin/leads87/[otroId]. |
| **Inconsistente** | Macro | Visual | **Solo etapa 2 tiene "Qué hacemos" / "Qué obtengo"** en las tarjetas macro. Las otras 7 etapas no tienen ese contenido en LEADS87 ni en LeadsOk. Si la decisión es tenerlo solo en etapa 2, está consistente; si se desea para más etapas, falta. | Confirmar si "Qué hacemos/obtengo" debe extenderse a más etapas; si no, dejar como está. |

---

## E. RECOMENDACIÓN DE PRIORIZACIÓN

### P1 – Orientación y no pérdida de información
1. **Barra "Progreso del proceso comercial"** (LeadsOk): Añadir en LEADS87 [id] para que en todo momento se vea % y etapa actual.
2. **Bloque "Reportes y documentos"** (Oportunidades): Añadir en LEADS87 [id] con estados y enlaces a Ver/Exportar/Compartir para no perder visibilidad de documentos.
3. **Ficha del lead desplegable en detalle** (Oportunidades): Nombre clickeable + panel con datos y edición (o link a edición) para no perder capacidad de ver/editar lead sin ir a otra pantalla.

### P2 – Gestión de cartera y paridad de listado
4. **Métricas superiores** (Oportunidades): Activas, En propuesta, En seguimiento, Nuevas en LEADS87 list.
5. **"Solo mis leads"** (Oportunidades): Checkbox en filtros de LEADS87 si el API expone comercial.
6. **Kanban con drag & drop** (Oportunidades): Opcional; si se quiere paridad total, implementar arrastre y PATCH pipeline en LEADS87.

### P3 – Workspace y contexto
7. **Score comercial y Lectura automática del CRM** (Oportunidades): Incluir en LEADS87 (por ejemplo en cabezal o en primer paso) para no perder señales de calidad del lead.
8. **Tab Contexto** (Oportunidades): Decidir si LEADS87 debe tener pestañas (Contexto, Investigación, …) o si el flujo micro + un solo workspace es definitivo; si se eligen tabs, añadir Contexto con datos, score y edición.
9. **Mensaje de transición** (LeadsOk): "Paso 1 completado. Se habilitó Diagnóstico comercial" en paso 2 activo.

### P4 – Pulido y consistencia
10. **Responsable en cabezal** (Oportunidades): Mostrar comercial asignado en LEADS87 [id].
11. **Pipeline en cabezal** (Oportunidades): Línea opcional con pipeline o etapa en header.
12. **Estado bloqueado/rojo**: Definir criterio y usarlo en listado/stepper cuando aplique.
13. **Orden de bloques en detalle**: Asegurar Guía estratégica después de Reportes y documentos cuando este exista.

---

## Resumen por criterio de auditoría

| # | Criterio | Estado en LEADS87 | Resumen |
|---|----------|-------------------|---------|
| 1 | Gestión de cartera | Parcial | Listado/Kanban/filtros/búsqueda/Abrir/Nuevo lead y columnas Salud/%/Etapa/Estado/Abrir OK. Faltan: métricas agregadas, "Solo mis leads", kanban drag & drop. |
| 2 | Cabezal del lead | Falta | Falta ficha desplegable, responsable, pipeline explícito, salud y % en header del detalle. |
| 3 | Flujo macro | OK | 8 etapas, qué hacemos/obtengo en etapa 2, checklist, resultado, colores. Sin barra de progreso resumida. |
| 4 | Flujo micro | OK | Un paso activo, futuros bloqueados/pending, completados marcados, CTA del paso activo, mensaje de falta. Falta mensaje de transición en paso 2. |
| 5 | Workspace del paso activo | Parcial | Qué hacemos/obtengo y CTA están en micro + siguiente acción. Falta: barra de progreso del proceso, bloque Reportes y documentos, y (según decisión) tab Contexto con score y lectura CRM. |
| 6 | Motor IA / Módulos | OK | AiLeadReport integrado; progreso y tiempo estimado están en el componente. Falta superficie en LEADS87 para "Reportes y documentos" y resumen Ver/PDF/Gamma. |
| 7 | Reportes y documentos | Falta | No existe bloque en LEADS87; en Oportunidades sí (4 documentos, estados, Ver/Editar/PDF/Compartir). |
| 8 | Guía estratégica | OK | Presente, colapsada, contenido validado; posición correcta al final. |
| 9 | Sistema de orientación | Parcial | Etapa/paso/siguiente acción y CTA único verde están. Puede perderse: dónde ver documentos, dónde editar lead, y qué significa el % si no ve la barra de progreso. |
| 10 | Reglas visuales globales | Parcial | Verde/amarillo/naranja/gris usados. Rojo (bloqueado) definido pero no asignado. CTA principal a veces gris (completar datos). |
| 11 | No perder nada de las 3 versiones | Parcial | Listado: falta métricas y "Solo mis leads" y kanban drag. Detalle: falta ficha, responsable, pipeline, barra progreso, Reportes y documentos, Score/Lectura CRM, edición lead, mensaje transición. |

---

**Conclusión:** LEADS87 tiene bien migrado el flujo macro, micro, guía estratégica, bloques del análisis comercial y el workspace con AiLeadReport e iframes. Para cerrar la migración sin omitir lo que ya existía en las otras tres pantallas, es prioritario añadir: (1) barra de progreso del proceso, (2) bloque Reportes y documentos, (3) ficha del lead desplegable en detalle, (4) métricas en listado y (5) decisión sobre tab Contexto y score/lectura CRM.
