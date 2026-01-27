# Checklist de Prueba - Agenda con fecha_limite

## ✅ Prerequisitos

1. **Ejecutar migración SQL**: 
   ```sql
   -- Ejecutar migrations/021_add_fecha_limite_to_socio_acciones.sql
   ```
   - Verificar que la columna `fecha_limite` existe en `public.socio_acciones`
   - Verificar que los índices se crearon correctamente

---

## ✅ 1. Crear Acción Pendiente en Lead

**Pasos:**
1. Abrir un lead en `/admin/leads/[id]`
2. Ir al tab "Acciones"
3. Seleccionar una fecha límite (ej: mañana)
4. (Opcional) Agregar una nota
5. Hacer click en uno de los botones: "+ Llamada", "+ WhatsApp", "+ Email", "+ Reunión"

**Resultado esperado:**
- ✅ La acción se crea correctamente
- ✅ En la DB: `fecha_limite` = fecha seleccionada, `realizada_at` = NULL
- ✅ La acción aparece en la lista del lead
- ✅ La acción aparece en `/admin/agenda` (si está en el rango: hoy-7 a hoy+14 días)

**Verificar en DB:**
```sql
SELECT id, tipo, nota, fecha_limite, realizada_at, lead_id, socio_id 
FROM public.socio_acciones 
WHERE lead_id = '<lead_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## ✅ 2. Crear Acción Pendiente en Socio

**Pasos:**
1. Abrir un socio en `/admin/socios/[id]`
2. Ir al tab "Acciones"
3. Seleccionar una fecha límite (ej: en 3 días)
4. (Opcional) Agregar una nota
5. Hacer click en uno de los botones: "+ Llamada", "+ WhatsApp", "+ Email", "+ Reunión"

**Resultado esperado:**
- ✅ La acción se crea correctamente
- ✅ En la DB: `fecha_limite` = fecha seleccionada, `realizada_at` = NULL
- ✅ La acción aparece en la lista del socio
- ✅ La acción aparece en `/admin/agenda` (si está en el rango: hoy-7 a hoy+14 días)

**Verificar en DB:**
```sql
SELECT id, tipo, nota, fecha_limite, realizada_at, lead_id, socio_id 
FROM public.socio_acciones 
WHERE socio_id = '<socio_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## ✅ 3. Verificar Agenda Muestra Acciones Pendientes

**Pasos:**
1. Crear al menos 2 acciones pendientes:
   - Una en un lead con fecha límite = mañana
   - Una en un socio con fecha límite = en 3 días
2. Abrir `/admin/agenda`

**Resultado esperado:**
- ✅ La agenda muestra ambas acciones
- ✅ Las acciones están agrupadas por día (fecha_limite)
- ✅ Las acciones más urgentes aparecen primero
- ✅ Cada acción muestra:
   - Tipo (Llamada, WhatsApp, etc.)
   - Nombre del lead/socio (owner_name)
   - Nota (si existe)
   - Link a la ficha del lead/socio

**Verificar en Network (DevTools):**
- Request a `/api/admin/agenda` debe devolver `status: 200`
- Response debe incluir `data: [...]` con las acciones
- Cada item debe tener `fecha_limite`, `owner_type`, `owner_name`

---

## ✅ 4. Marcar Acción como Ejecutada

**Pasos:**
1. En la ficha de un lead o socio, abrir el tab "Acciones"
2. Encontrar una acción pendiente (sin badge "✅ Ejecutada")
3. Hacer click en el botón "Ejecutada"

**Resultado esperado:**
- ✅ La acción desaparece de `/admin/agenda` (ya no es pendiente)
- ✅ En la DB: `realizada_at` = timestamp ISO (contiene 'T'), `fecha_limite` NO cambia
- ✅ En la lista del lead/socio: la acción muestra badge "✅ Ejecutada"
- ✅ El botón "Ejecutada" desaparece, se muestra la fecha/hora de ejecución

**Verificar en DB:**
```sql
SELECT id, tipo, fecha_limite, realizada_at 
FROM public.socio_acciones 
WHERE id = '<accion_id>';
```
- `realizada_at` debe ser un timestamp ISO (ej: `2025-01-25T14:30:00.000Z`)
- `fecha_limite` debe mantener su valor original

---

## ✅ 5. Verificar Rango de Fechas en Agenda

**Pasos:**
1. Crear acciones con diferentes fechas límite:
   - Una con fecha límite = hace 10 días (fuera del rango)
   - Una con fecha límite = hace 5 días (dentro del rango: hoy-7)
   - Una con fecha límite = hoy
   - Una con fecha límite = en 10 días (dentro del rango: hoy+14)
   - Una con fecha límite = en 20 días (fuera del rango)
2. Abrir `/admin/agenda`

**Resultado esperado:**
- ✅ Solo muestra acciones con fecha_limite entre (hoy-7 días) y (hoy+14 días)
- ✅ NO muestra la acción de hace 10 días (fuera del rango)
- ✅ NO muestra la acción de en 20 días (fuera del rango)
- ✅ SÍ muestra las acciones dentro del rango

---

## ✅ 6. Verificar Manejo de Errores

**Pasos:**
1. (Simular error) Si la columna `fecha_limite` no existe en la DB:
   - El endpoint `/api/admin/agenda` debe devolver `status: 500`
   - El response debe incluir `error: "Error obteniendo acciones de leads/socios: ..."`
   - NO debe devolver `status: 200` con `data: []` silenciosamente

**Resultado esperado:**
- ✅ Si hay error en la query, el endpoint devuelve 500 con mensaje de error
- ✅ La UI muestra el error al usuario (no muestra agenda vacía silenciosamente)

---

## ✅ 7. Verificar Ordenamiento

**Pasos:**
1. Crear varias acciones con diferentes fechas límite:
   - Fecha límite = en 5 días
   - Fecha límite = mañana
   - Fecha límite = hoy
   - Fecha límite = en 3 días
2. Abrir `/admin/agenda`

**Resultado esperado:**
- ✅ Las acciones están ordenadas por `fecha_limite` ASC (más urgente primero)
- ✅ Orden esperado: hoy → mañana → en 3 días → en 5 días
- ✅ Si hay empate en fecha_limite, ordenar por `created_at` ASC

---

## ✅ 8. Verificar Backfill de Migración

**Pasos:**
1. (Solo si hay datos viejos) Verificar que la migración hizo backfill correctamente:
   ```sql
   SELECT id, tipo, fecha_limite, realizada_at, created_at
   FROM public.socio_acciones
   WHERE fecha_limite IS NOT NULL
     AND realizada_at IS NOT NULL
     AND realizada_at::date > CURRENT_DATE
     AND realizada_at::text NOT LIKE '%T%';
   ```

**Resultado esperado:**
- ✅ Si había registros viejos donde `realizada_at` era una fecha futura (sin 'T'), ahora tienen `fecha_limite` = `realizada_at::date`
- ✅ Los registros donde `realizada_at` es un timestamp ISO (ejecutadas) NO fueron modificados

---

## ✅ 9. Verificar Estado "Ejecutada" en UI

**Pasos:**
1. En la ficha de un lead/socio, abrir el tab "Acciones"
2. Verificar que:
   - Acciones con `realizada_at IS NULL` muestran badge "Pendiente"
   - Acciones con `realizada_at` (timestamp ISO) muestran badge "✅ Ejecutada"
   - El estado NO depende de `fecha_limite`, solo de `realizada_at`

**Resultado esperado:**
- ✅ El estado "ejecutada" se determina correctamente por `realizada_at`
- ✅ `fecha_limite` solo se usa para mostrar la fecha límite y determinar si está vencida

---

## ✅ 10. Verificar Acciones Vencidas

**Pasos:**
1. Crear una acción con fecha límite = ayer
2. Verificar que muestra badge "VENCIDA" en rojo
3. Marcar como ejecutada
4. Verificar que el badge desaparece

**Resultado esperado:**
- ✅ Las acciones con `fecha_limite < hoy` y `realizada_at IS NULL` muestran badge "VENCIDA"
- ✅ Al marcarlas como ejecutadas, el badge desaparece

---

## 📝 Notas Importantes

- **Migración requerida**: Ejecutar `migrations/021_add_fecha_limite_to_socio_acciones.sql` antes de usar
- **Backward compatible**: La columna `fecha_limite` es nullable, así que no rompe datos existentes
- **Separación clara**: 
  - `fecha_limite`: DATE - fecha objetivo (deadline)
  - `realizada_at`: TIMESTAMPTZ - cuándo se ejecutó (NULL si pendiente)
- **Manejo de errores**: El endpoint de agenda ahora devuelve 500 si hay errores (no devuelve [] silenciosamente)
