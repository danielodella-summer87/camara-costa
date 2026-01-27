# Resumen de Fix - Agenda con fecha_limite

## 🐛 Bug Reportado

- `/admin/agenda` no mostraba acciones
- `public.socio_acciones` NO tenía columna `fecha_limite`
- El endpoint filtraba por `fecha_limite` y al no existir, Supabase devolvía error
- El código ignoraba el error y retornaba `data: []` con `status: 200` silenciosamente

---

## ✅ Cambios Implementados

### 1. Migración SQL (`migrations/021_add_fecha_limite_to_socio_acciones.sql`)

**Cambios:**
- ✅ Agrega columna `fecha_limite DATE NULL` a `public.socio_acciones`
- ✅ Crea índices para performance:
  - `idx_socio_acciones_fecha_limite` - índice simple
  - `idx_socio_acciones_fecha_limite_pendientes` - índice compuesto para agenda
  - `idx_socio_acciones_lead_fecha_limite` - índice compuesto para leads
  - `idx_socio_acciones_socio_fecha_limite` - índice compuesto para socios
- ✅ **Backfill opcional**: Si hay registros viejos donde `realizada_at` parece ser una fecha futura usada como "fecha limite", copia `fecha_limite = (realizada_at::date)` SOLO si:
  - `realizada_at::date > current_date` (futuro)
  - `realizada_at::date >= created_at::date` (lógica)
  - `fecha_limite IS NULL` (no sobrescribir si ya tiene valor)
  - `realizada_at::text NOT LIKE '%T%'` (excluir timestamps ISO ejecutadas)

**Razón:** Necesitamos un campo DATE real para la fecha límite, separado de `realizada_at` (que indica cuándo se ejecutó).

---

### 2. Endpoint Agenda (`app/api/admin/agenda/route.ts`)

**Cambios:**
- ✅ **Manejo de errores corregido**: Si `leadsQuery` o `sociosQuery` da error, devuelve `status: 500` con mensaje de error (NO devuelve `[]` silenciosamente)
- ✅ Filtro agregado: `.not("fecha_limite", "is", null)` - solo acciones con fecha_limite definida
- ✅ Filtro: `.is("realizada_at", null)` - solo acciones pendientes
- ✅ Rango: `fecha_limite` entre `(hoy - 7 días)` y `(hoy + 14 días)`
- ✅ Ordenamiento: `.order("fecha_limite", { ascending: true })` - más urgente primero

**Razón:** El endpoint debe manejar errores correctamente y solo mostrar acciones pendientes con fecha_limite definida.

---

### 3. Endpoints de Acciones (POST)

**Estado:** ✅ Ya correctos

**`app/api/admin/leads/[id]/acciones/route.ts` (POST):**
- ✅ Al crear acción: guarda `fecha_limite` y deja `realizada_at = NULL`
- ✅ No setea `realizada_at` al crear

**`app/api/admin/socios/[id]/acciones/route.ts` (POST):**
- ✅ Al crear acción: guarda `fecha_limite` y deja `realizada_at = NULL`
- ✅ No setea `realizada_at` al crear

**Razón:** Al crear una acción, solo debe setear `fecha_limite`. `realizada_at` solo se setea cuando se marca como ejecutada.

---

### 4. Endpoints de Acciones (PATCH - Marcar Ejecutada)

**Estado:** ✅ Ya correctos

**`app/api/admin/leads/[id]/acciones/[accion_id]/route.ts` (PATCH):**
- ✅ Al marcar ejecutada: setea `realizada_at = now()` (timestamp ISO)
- ✅ NO toca `fecha_limite`

**`app/api/admin/socios/[id]/acciones/[accion_id]/route.ts` (PATCH):**
- ✅ Al marcar ejecutada: setea `realizada_at = now()` (timestamp ISO)
- ✅ NO toca `fecha_limite`

**Razón:** Al marcar como ejecutada, solo debe actualizar `realizada_at`. `fecha_limite` debe mantenerse intacta.

---

### 5. UI Component (`components/acciones/Acciones.tsx`)

**Estado:** ✅ Ya correcto

- ✅ Al crear acción: envía `fecha_limite` en el body
- ✅ Estado "ejecutada" depende de `realizada_at` (no de `fecha_limite`)
- ✅ Función `isDone()` verifica si `realizada_at` contiene 'T' (timestamp ISO)
- ✅ Muestra `fecha_limite` como fecha límite
- ✅ Muestra badge "VENCIDA" si `fecha_limite < hoy` y `realizada_at IS NULL`

**Razón:** La UI ya estaba usando `fecha_limite` y `realizada_at` correctamente.

---

## 🔄 Separación Conceptual

### Antes (Confuso):
- `realizada_at` se usaba como fecha límite (YYYY-MM-DD) cuando se creaba
- `realizada_at` se convertía en timestamp ISO cuando se ejecutaba
- No había separación clara entre "fecha límite" y "ejecutada"

### Ahora (Claro):
- **`fecha_limite`**: DATE - fecha objetivo (deadline) de la acción
- **`realizada_at`**: TIMESTAMPTZ - cuándo se ejecutó (NULL si pendiente, timestamp ISO si ejecutada)

---

## 📊 Diferencias en el Código

### Endpoint Agenda - Manejo de Errores

**Antes:**
```typescript
if (leadsResult.error) {
  console.error("[Agenda] Error obteniendo acciones de leads:", leadsResult.error);
}
// Continúa y devuelve [] silenciosamente
```

**Ahora:**
```typescript
if (leadsResult.error) {
  console.error("[Agenda] Error obteniendo acciones de leads:", leadsResult.error);
  return NextResponse.json(
    { 
      data: null, 
      error: `Error obteniendo acciones de leads: ${leadsResult.error.message}` 
    } satisfies ApiResp<null>,
    { status: 500 }
  );
}
```

### Endpoint Agenda - Filtro de fecha_limite

**Antes:**
```typescript
.gte("fecha_limite", startDateStr)
.lte("fecha_limite", endDateStr)
// Si fecha_limite no existe, Supabase devuelve error pero se ignora
```

**Ahora:**
```typescript
.not("fecha_limite", "is", null) // Solo acciones con fecha_limite definida
.gte("fecha_limite", startDateStr)
.lte("fecha_limite", endDateStr)
// Si hay error, se devuelve 500 con mensaje
```

---

## ✅ Verificaciones

- ✅ Sin errores de linting TypeScript
- ✅ Migración SQL con backfill opcional
- ✅ Manejo de errores correcto en endpoint de agenda
- ✅ Endpoints POST no setean `realizada_at` al crear
- ✅ Endpoints PATCH solo setean `realizada_at` al marcar ejecutada
- ✅ UI usa `fecha_limite` y `realizada_at` correctamente

---

## 🧪 Pruebas Recomendadas

Ver `CHECKLIST_AGENDA_FECHA_LIMITE.md` para checklist completo de pruebas.

**Pruebas críticas:**
1. Ejecutar migración SQL
2. Crear acción pendiente en lead/socio → verificar que aparece en agenda
3. Marcar acción como ejecutada → verificar que desaparece de agenda
4. Verificar que el endpoint devuelve 500 si hay error (no [] silenciosamente)

---

## 📝 Notas Importantes

- **Migración requerida**: Ejecutar `migrations/021_add_fecha_limite_to_socio_acciones.sql` antes de usar
- **Backward compatible**: La columna `fecha_limite` es nullable, así que no rompe datos existentes
- **Backfill opcional**: La migración intenta migrar datos viejos donde `realizada_at` era una fecha futura
- **Manejo de errores**: El endpoint de agenda ahora devuelve 500 si hay errores (no devuelve [] silenciosamente)
- **Separación clara**: 
  - `fecha_limite`: DATE - fecha objetivo (deadline)
  - `realizada_at`: TIMESTAMPTZ - cuándo se ejecutó (NULL si pendiente)
