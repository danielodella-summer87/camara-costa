# Checklist de Prueba - Acciones para Leads

## Cambios Implementados

### 1. Migración de Base de Datos
- **`migrations/020_add_lead_id_to_socio_acciones.sql`**:
  - Agrega columna `lead_id` a `socio_acciones`
  - Agrega Foreign Key a `leads(id)`
  - Agrega constraint: debe tener `socio_id` O `lead_id` (pero no ambos)
  - Crea índices para performance

### 2. Componente Reutilizable
- **`components/acciones/Acciones.tsx`**:
  - Componente genérico que acepta `socioId` o `leadId`
  - Reutiliza toda la lógica y UI de acciones
  - Determina automáticamente el endpoint según el tipo de entidad

### 3. Endpoints API para Leads
- **`app/api/admin/leads/[id]/acciones/route.ts`**:
  - `GET`: Lista acciones del lead
  - `POST`: Crea acción para el lead
- **`app/api/admin/leads/[id]/acciones/[accion_id]/route.ts`**:
  - `PATCH`: Marca acción como ejecutada

### 4. Integración en UI
- **`app/admin/leads/[id]/page.tsx`**:
  - Agrega tab "Acciones" en la ficha de lead
  - Usa componente `Acciones` con `leadId`

### 5. Refactorización de Socios
- **`app/admin/socios/[id]/SocioAcciones.tsx`**:
  - Simplificado para usar el componente genérico `Acciones`
  - Mantiene compatibilidad total

### 6. Migración Automática
- **`app/api/admin/leads/[id]/convert-to-member/route.ts`**:
  - Al convertir lead → socio, migra automáticamente todas las acciones
  - Limpia `lead_id` y setea `socio_id`
  - Logs para debugging

### 7. Actualización de Endpoints de Socios
- **`app/api/admin/socios/[id]/acciones/route.ts`**:
  - Actualizado para incluir `lead_id` en selects
  - Asegura que `lead_id` sea `null` al crear acciones de socio
- **`app/api/admin/socios/[id]/acciones/[accion_id]/route.ts`**:
  - Actualizado para incluir `lead_id` en selects

---

## Checklist de Prueba

### ✅ 1. Crear Acción en Lead

**Pasos:**
1. Abrir un lead en `/admin/leads/[id]`
2. Ir al tab "Acciones"
3. Seleccionar una fecha límite
4. (Opcional) Agregar una nota
5. Hacer click en uno de los botones: "+ Llamada", "+ WhatsApp", "+ Email", "+ Reunión"

**Resultado esperado:**
- ✅ La acción se crea correctamente
- ✅ Aparece en la lista de acciones
- ✅ Muestra el tipo, fecha límite, estado "Pendiente", nota y fecha de creación
- ✅ En la DB: `socio_acciones` tiene `lead_id` = id del lead y `socio_id` = NULL

**Verificar en DB:**
```sql
SELECT id, lead_id, socio_id, tipo, nota, realizada_at, created_at 
FROM socio_acciones 
WHERE lead_id = '<lead_id>' 
ORDER BY created_at DESC;
```

---

### ✅ 2. Ver Acción en Lead

**Pasos:**
1. Abrir un lead que tenga acciones creadas
2. Ir al tab "Acciones"
3. Verificar que se muestran todas las acciones del lead

**Resultado esperado:**
- ✅ Se cargan todas las acciones del lead
- ✅ Se ordenan por fecha de creación (más nuevas arriba)
- ✅ Se muestran correctamente: tipo, fecha límite, estado, nota, fecha de creación
- ✅ Si hay acciones vencidas, muestran badge "VENCIDA" en rojo

---

### ✅ 3. Marcar Acción como Ejecutada en Lead

**Pasos:**
1. Abrir un lead con acciones pendientes
2. Ir al tab "Acciones"
3. Hacer click en el botón "Ejecutada" de una acción pendiente

**Resultado esperado:**
- ✅ La acción se marca como ejecutada
- ✅ Cambia el estado a "✅ Ejecutada" (verde)
- ✅ Se actualiza `realizada_at` en la DB
- ✅ El botón "Ejecutada" desaparece y se muestra la fecha/hora de ejecución

**Verificar en DB:**
```sql
SELECT realizada_at FROM socio_acciones WHERE id = '<accion_id>';
-- Debe tener un timestamp reciente
```

---

### ✅ 4. Convertir Lead en Socio

**Pasos:**
1. Crear un lead con al menos 2-3 acciones (algunas ejecutadas, algunas pendientes)
2. Anotar los IDs de las acciones
3. Convertir el lead en socio (cambiar pipeline a "Ganado" o usar botón de conversión)
4. Verificar que el socio se creó correctamente

**Resultado esperado:**
- ✅ El lead se convierte en socio correctamente
- ✅ Las acciones del lead se migran al socio
- ✅ En la DB: las acciones tienen `lead_id` = NULL y `socio_id` = id del socio
- ✅ No se duplican acciones
- ✅ No se pierden acciones

**Verificar en DB:**
```sql
-- Antes de convertir: acciones del lead
SELECT id, lead_id, socio_id FROM socio_acciones WHERE lead_id = '<lead_id>';

-- Después de convertir: deben estar migradas al socio
SELECT id, lead_id, socio_id FROM socio_acciones WHERE socio_id = '<socio_id>';
-- lead_id debe ser NULL, socio_id debe ser el id del socio
-- El número de acciones debe ser el mismo
```

**Verificar en logs del servidor:**
```
[convert-to-member] Migradas X acciones del lead al socio
```

---

### ✅ 5. Verificar que la Acción Aparece en el Socio

**Pasos:**
1. Después de convertir el lead en socio
2. Abrir la ficha del socio en `/admin/socios/[socio_id]`
3. Ir a la sección "Acciones comerciales"

**Resultado esperado:**
- ✅ Todas las acciones migradas aparecen en el socio
- ✅ Se mantienen todos los datos: tipo, nota, fecha límite, estado
- ✅ Las acciones ejecutadas siguen marcadas como ejecutadas
- ✅ Las acciones pendientes siguen pendientes
- ✅ No hay duplicados

---

### ✅ 6. Verificar que No se Duplica ni se Pierde

**Pasos:**
1. Crear un lead con 5 acciones
2. Anotar los IDs de todas las acciones
3. Convertir el lead en socio
4. Verificar en la DB que:
   - Existen exactamente 5 acciones con `socio_id` = id del socio
   - No existen acciones con `lead_id` = id del lead (deben ser NULL)
   - Los IDs de las acciones son los mismos (no se crearon nuevas)

**Verificar en DB:**
```sql
-- Contar acciones del lead (debe ser 0 después de migrar)
SELECT COUNT(*) FROM socio_acciones WHERE lead_id = '<lead_id>';

-- Contar acciones del socio (debe ser igual al número original)
SELECT COUNT(*) FROM socio_acciones WHERE socio_id = '<socio_id>';

-- Verificar que los IDs son los mismos
SELECT id FROM socio_acciones WHERE socio_id = '<socio_id>' ORDER BY created_at;
```

---

### ✅ 7. Crear Acción en Socio (Verificar Compatibilidad)

**Pasos:**
1. Abrir un socio existente
2. Crear una nueva acción
3. Verificar que funciona correctamente

**Resultado esperado:**
- ✅ La acción se crea correctamente
- ✅ En la DB: `socio_id` = id del socio y `lead_id` = NULL
- ✅ No se rompe la funcionalidad existente de socios

---

### ✅ 8. Acciones Vencidas

**Pasos:**
1. Crear una acción en un lead con fecha límite pasada (ej: ayer)
2. Verificar que se muestra el badge "VENCIDA" en rojo
3. Marcar como ejecutada
4. Verificar que el badge desaparece

**Resultado esperado:**
- ✅ Las acciones vencidas muestran badge "VENCIDA" en rojo
- ✅ Al marcarlas como ejecutadas, el badge desaparece
- ✅ Funciona igual para leads y socios

---

### ✅ 9. Validación de Constraint (socio_id O lead_id)

**Pasos:**
1. Intentar crear una acción con ambos `socio_id` y `lead_id` (desde DB directamente)
2. Intentar crear una acción sin `socio_id` ni `lead_id`

**Resultado esperado:**
- ✅ La DB rechaza ambos casos (constraint activo)
- ✅ Los endpoints API solo crean acciones con uno u otro, nunca ambos

**Verificar constraint:**
```sql
-- Esto debe fallar:
INSERT INTO socio_acciones (socio_id, lead_id, tipo, nota, realizada_at) 
VALUES ('socio-id', 'lead-id', 'llamada', 'test', '2025-01-25');

-- Esto también debe fallar:
INSERT INTO socio_acciones (tipo, nota, realizada_at) 
VALUES ('llamada', 'test', '2025-01-25');
```

---

### ✅ 10. Performance y Carga

**Pasos:**
1. Crear un lead con 20+ acciones
2. Abrir el tab "Acciones"
3. Verificar que carga rápidamente

**Resultado esperado:**
- ✅ La lista carga en menos de 1 segundo
- ✅ Los índices funcionan correctamente
- ✅ No hay queries N+1

---

## Notas Importantes

- **Migración requerida**: Ejecutar `migrations/020_add_lead_id_to_socio_acciones.sql` antes de usar
- **Compatibilidad**: El sistema de socios sigue funcionando exactamente igual
- **Migración automática**: Al convertir lead → socio, las acciones se migran automáticamente
- **Sin duplicación**: Las acciones se mueven (no se copian), evitando duplicados

---

## Comandos SQL Útiles para Verificación

```sql
-- Ver todas las acciones de un lead
SELECT * FROM socio_acciones WHERE lead_id = '<lead_id>' ORDER BY created_at DESC;

-- Ver todas las acciones de un socio
SELECT * FROM socio_acciones WHERE socio_id = '<socio_id>' ORDER BY created_at DESC;

-- Ver acciones migradas (deben tener lead_id NULL y socio_id no NULL)
SELECT * FROM socio_acciones WHERE lead_id IS NULL AND socio_id IS NOT NULL;

-- Contar acciones por tipo de entidad
SELECT 
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) as acciones_leads,
  COUNT(*) FILTER (WHERE socio_id IS NOT NULL) as acciones_socios
FROM socio_acciones;
```
