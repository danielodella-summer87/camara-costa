# IA EASY — Roadmap

Documento de contexto para ordenar el trabajo en Git antes de seguir con EASY y el despliegue en Vercel. No sustituye tickets ni especificación formal.

---

## Estado actual

- **Admin `/admin/ia`**: pestañas Dashboard IA, Configuración, Prompts activos, Categorías, Perfiles de análisis.
- **Prompts**: campos estructurados como fuente de verdad; `prompt_content` como caché derivada; validación con `hasRequiredPromptSectionsFromRow` / helpers en `lib/ai/promptStructure.ts`.
- **Guardado**: un solo flujo “Guardar prompt” con validación previa; sin botón “Validar” separado.
- **Configuración**: orden del perfil activo con drag & drop y persistencia en `ai_profile_prompts.execution_order` (endpoint dedicado de reorden).
- **Dashboard**: KPIs de catálogo vs perfil aclarados en UI; bloques “Orden de ejecución” y “Prompts por categoría” colapsados por defecto; conteo por categoría según prompts habilitados del perfil activo.
- **UX visual**: paleta pastel por nombre de categoría (Configuración, Prompts activos, Categorías, Dashboard, Perfiles).
- **Entrada**: tab inicial **Dashboard IA** (no Prompts activos).
- **Módulo / esquema**: el flujo de readiness/inicialización permite que el módulo arranque sin tablas seed obligatorias hasta completar setup (según política del proyecto).

---

## Diferencias con prototipo

| Área | Prototipo (típico) | EASY (actual) |
|------|-------------------|---------------|
| Validación | Guardar borrador vs validar en pasos separados | Validación obligatoria en el único guardado |
| Dashboard | Mezcla de métricas “globales” y “por perfil” sin aclarar | Textos que distinguen catálogo validado vs prompts en perfil |
| Orden de prompts | Solo en pantalla de perfiles o manual por número | Lista en Configuración con DnD + API de reorder |
| Esquema IA | Banner de diagnóstico en dashboard | Eliminado a favor de flujo operativo |
| Navegación | Prompts activos como vista por defecto | Dashboard IA por defecto |

*(Ajustar filas si el prototipo interno difiere.)*

---

## Decisiones tomadas

1. **Módulo nuevo puede arrancar vacío** — sin asumir datos seed; inicialización/readiness explícitos donde aplique.
2. **Dashboard IA como tab por defecto** al entrar a `/admin/ia`.
3. **Un solo botón “Guardar prompt”** — sin flujo manual de “Validar” aparte.
4. **Validación integrada al guardado** — si falla la estructura requerida, no se persiste y se muestran errores en UI.
5. **Prompts agrupables por categoría** — vista en Prompts activos (`<details>` por categoría) y datos de categoría en tarjetas/listas.
6. **Colores pastel por categoría** — mapping central en `categoryPastel.ts` + fallback gris para “Sin categoría”.
7. **Colapsables por defecto en dashboard** — “Orden de ejecución” y “Prompts por categoría” empiezan cerrados; expansión manual.
8. **Perfil vs catálogo** — conteos del dashboard alineados semánticamente: catálogo validado ≠ prompts enlazados/habilitados en el perfil activo (`ai_profile_prompts`).

---

## Próximos pasos recomendados

1. **Ejecución IA sobre lead** — orquestación única (p. ej. `POST` informe), perfil activo, `execution_order`, prompt canónico por fila, persistencia de salidas por bloque (diseño ya discutido; implementar por fases).
2. **Vercel** — variables `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, claves OpenAI si aplica; revisar `runtime` y timeouts en rutas largas de IA.
3. **Git** — commit atómico del módulo IA + doc; tag o rama `easy/ia` si el equipo lo usa.
4. **Pruebas manuales** — cambio de perfil activo, reorder, guardado con prompt inválido/válido, dashboard con perfil sin enlaces.
5. **Documentar** diferencias finales prototipo ↔ producción cuando EASY cierre el ciclo.

---

## Riesgos a evitar

- **Asumir** que “16 prompts en catálogo” = “16 en perfil activo” sin filas en `ai_profile_prompts`.
- **Doble fuente de verdad** en prompts: seguir usando campos estructurados + canónico, no solo `prompt_content` crudo para validar o ejecutar.
- **Rutas IA largas** en serverless sin streaming ni límites — riesgo de timeout en Vercel.
- **Mezclar** en un mismo PR refactors grandes de CRM con IA; mantener cambios IA acotados y revisables.
- **Omitir** `config.update` / RBAC en nuevos endpoints de configuración IA.

---

*Última actualización: contexto de implementación EASY (admin IA, validación, dashboard, DnD, pastel, colapsables).*
