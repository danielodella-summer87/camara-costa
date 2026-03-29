# IA EASY — Notas de base de datos (Supabase)

Documentación **mínima** sobre el modelo IA versionado en el repo y sobre **cambios que a menudo se aplican a mano** en el SQL Editor de Supabase en instancias EASY. Completar filas concretas (UUIDs, nombres exactos) según tu proyecto antes de Vercel u otros entornos.

> Parte del estado operativo del módulo puede depender de **SQL manual** ejecutado solo en una instancia; este archivo sirve para no perder ese contexto.

---

## Tablas involucradas (esquema versionado en `migrations/`)

| Tabla | Rol |
|-------|-----|
| **`ai_categories`** | Catálogo de categorías (`id`, `name`, `description`, `is_active`, …). |
| **`ai_prompts`** | Prompts (`category_id` → `ai_categories`, campos estructurados, `prompt_content`, `status` draft/validated, …). |
| **`ai_analysis_profiles`** | Perfiles de análisis (p. ej. “Easy”), `is_active`, `base_instructions`, más columnas añadidas en migraciones posteriores (`cierre_oferta_principal`, `tipo_organizacion_vendedora`, …). |
| **`ai_profile_prompts`** | **N:M** perfil ↔ prompt: `profile_id`, `prompt_id`, `enabled_by_default`, **`execution_order`**, `id` propio de la fila de enlace. |

Índice útil: `(profile_id, execution_order)` en `ai_profile_prompts`.

---

## Categoría y orden (aclaración)

- **Categoría (datos):** en el código y migraciones actuales la relación es **`ai_prompts.category_id`** → **`ai_categories`**. La UI muestra el nombre vía join/embed (`ai_categories.name`). No hay en el repo una columna estándar llamada `category` en `ai_prompts` (el concepto es la FK).
- **Orden de ejecución del motor (por perfil):** vive en **`ai_profile_prompts.execution_order`** (enteros; en la app se usan con frecuencia múltiplos de 10: 10, 20, 30…).
- **`category_order`:** **no aparece** en las migraciones IA del repositorio. Si en Supabase se añadió una columna manual (p. ej. orden global de categorías), **documentarla aquí abajo en “Cambios manuales”** con nombre de columna, tabla y propósito; si no existe, ignorar este punto en la instancia.

---

## Estado actual en base de datos

*(Completar por entorno; plantilla.)*

- **Perfil activo EASY:** nombre en `ai_analysis_profiles`, `is_active = true` (solo uno activo según reglas de negocio).
- **Filas en `ai_profile_prompts`:** cantidad de prompts enlazados al perfil Easy; valores actuales de `enabled_by_default` y `execution_order`.
- **`ai_prompts`:** cuántos en `validated` vs `draft`; categorías usadas vía `category_id`.
- **`ai_categories`:** listado de nombres alineados con la UI pastel (Investigación, Diagnóstico, …) si aplica.

**Consultas de comprobación (ejemplo):**

```sql
-- Perfiles
select id, name, is_active from ai_analysis_profiles order by name;

-- Enlaces del perfil Easy (sustituir :profile_id)
select pp.id, pp.execution_order, pp.enabled_by_default, p.name
from ai_profile_prompts pp
join ai_prompts p on p.id = pp.prompt_id
where pp.profile_id = :profile_id
order by pp.execution_order;

-- Prompts por categoría
select c.name as category, count(*) 
from ai_prompts p
join ai_categories c on c.id = p.category_id
group by c.name
order by c.name;
```

---

## Cambios manuales realizados

*(Anotar lo hecho en Supabase que no quedó reflejado en una migración nueva del repo.)*

1. **Asociaciones perfil “Easy” ↔ prompts**  
   - Inserciones/updates en **`ai_profile_prompts`** (por `profile_id` del Easy y `prompt_id` de cada prompt).  
   - Si se copiaron datos desde otro perfil: indicar origen.

2. **Ajustes de `execution_order`**  
   - Reordenación directa con `UPDATE … SET execution_order = … WHERE id = …` o equivalente.  
   - Hoy el admin también puede persistir orden vía API de reorder; anotar si hubo correcciones solo en SQL.

3. **Categorías**  
   - Altas/edits en **`ai_categories`**.  
   - Reasignación **`ai_prompts.category_id`** para alinear nombres con la paleta UI / flujo EASY.

4. **`category_order` (si aplica)**  
   - Si existe columna u orden manual por categoría: tabla, definición y valores.

5. **Otros**  
   - Seeds puntuales, flags `is_active`, datos de `cierre_oferta_principal` / `tipo_organizacion_vendedora`, etc.

---

## Riesgos si no se migran luego a código / `migrations/`

- **Entornos nuevos** (p. ej. Vercel + nueva DB de staging/prod) **no reproducen** enlaces ni órdenes solo con despliegue del código.
- **Drift:** la instancia “correcta” es la que tiene el SQL manual; el repo queda incompleto como fuente de verdad.
- **Onboarding:** otro desarrollador no ve en Git el estado real del motor IA.
- **Rollback / restore:** backups pueden no coincidir con lo documentado si no hay migración equivalente.

---

## Próximos pasos recomendados

1. Volcar los cambios manuales estables a **nuevos archivos en `migrations/`** (o script idempotente documentado) con comentarios.
2. Antes de producción en Vercel: **ejecutar migraciones** en el proyecto Supabase destino y **verificar** las consultas de la sección “Estado actual”.
3. Opcional: exportar un **dump solo de datos IA** (tablas anteriores) para entornos internos, sin secretos.
4. Mantener este archivo actualizado cuando se haga SQL puntual en Supabase.

---

*Este documento no modifica aplicación ni API; solo describe prácticas y esquema esperado.*
