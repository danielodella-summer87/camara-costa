# Checklist de Prueba - Reparación empresa_id

## Cambios Implementados

### Backend
1. **`lib/leads/updateLeadSafe.ts`**: 
   - REGLA 1: Si `empresa_id` NO viene en payload → NO modificar (preservar valor actual)
   - REGLA 2: Si `empresa_id` viene como `null` → SOLO aceptar si `force_unlink_entity: true`, caso contrario rechazar con 400
   - REGLA 3: Si `empresa_id` viene con valor → permitir el cambio
   - Logs temporales cuando se detecta intento de setear a null sin flag

2. **`app/api/admin/leads/[id]/route.ts`**:
   - Validación temprana: rechaza `empresa_id: null` sin `force_unlink_entity: true`
   - Solo incluye `empresa_id` en payload si viene explícitamente en el body
   - Pasa `force_unlink_entity` al helper

3. **`app/api/admin/leads/bulk/route.ts`**:
   - Usa `updateLeadSafe` con `force_unlink_entity: false` (nunca desvincular en bulk)
   - Preserva `empresa_id` en todos los updates masivos

4. **`app/api/admin/leads/[id]/ai-report/route.ts`**:
   - Usa `updateLeadSafe` con `force_unlink_entity: false` (nunca desvincular al actualizar informe IA)

5. **`app/api/admin/empresas/[id]/convert-to-lead/route.ts`**:
   - Usa `updateLeadSafe` cuando actualiza lead existente (vinculación explícita)

### Frontend
1. **`app/admin/leads/[id]/page.tsx`**:
   - Solo incluye `empresa_id` en payload si realmente cambió (comparación con valor actual)
   - No permite desvincular desde formulario normal (requiere botón específico)
   - Botón "Vincular" solo permite vincular, no desvincular

---

## Checklist de Prueba

### ✅ 1. Editar Lead (Ficha Individual)

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Editar cualquier campo (nombre, email, etc.) SIN tocar `empresa_id`
3. Guardar cambios

**Resultado esperado:**
- ✅ Lead se actualiza correctamente
- ✅ `empresa_id` se preserva (no cambia)
- ✅ En logs del servidor: `"empresa_id NO viene en payload, NO modificando"`

**Verificar en consola del servidor:**
```
[updateLeadSafe] Lead {id}: empresa_id NO viene en payload, NO modificando (se preserva valor actual en DB)
```

---

### ✅ 2. Regenerar Informe IA

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Ir a la pestaña "Informe IA"
3. Hacer click en "Generar IA" o "Regenerar IA"
4. Esperar a que se genere el informe

**Resultado esperado:**
- ✅ Informe se genera correctamente
- ✅ `empresa_id` se preserva (no cambia)
- ✅ No hay errores en consola

**Verificar en consola del servidor:**
```
[updateLeadSafe] Lead {id}: empresa_id NO viene en payload, NO modificando
```

---

### ✅ 3. Convertir a Cliente (Pipeline → Ganado)

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Cambiar pipeline a "Ganado"
3. Guardar

**Resultado esperado:**
- ✅ Lead se actualiza a "Ganado"
- ✅ Se crea socio automáticamente
- ✅ `empresa_id` se preserva en el lead
- ✅ `empresa_id` se asigna al socio

**Verificar en consola del servidor:**
```
[PATCH lead] Socio upsert OK: leadId={id}, socioId={id}, empresaId={empresa_id}
```

---

### ✅ 4. Bulk Update (Actualización Masiva)

**Pasos:**
1. Ir a la lista de leads
2. Seleccionar múltiples leads (algunos con `empresa_id`, otros sin)
3. Cambiar pipeline de todos a una etapa (ej: "Calificado")
4. Aplicar cambios

**Resultado esperado:**
- ✅ Todos los leads se actualizan correctamente
- ✅ Leads con `empresa_id` lo preservan
- ✅ Leads sin `empresa_id` siguen sin tenerlo
- ✅ No se pierde ninguna vinculación

**Verificar en consola del servidor:**
```
[updateLeadSafe] Lead {id}: empresa_id NO viene en payload, NO modificando
```

---

### ✅ 5. Intentar Desvincular Sin Flag (Debe Fallar)

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Usar DevTools → Network
3. Hacer un PATCH manual con:
   ```json
   {
     "empresa_id": null
   }
   ```

**Resultado esperado:**
- ✅ Request falla con 400
- ✅ Mensaje de error: "No se puede desvincular empresa_id sin el flag force_unlink_entity: true"
- ✅ `empresa_id` NO se modifica en la DB
- ✅ Logs temporales en consola del servidor:
   ```
   [updateLeadSafe] ⚠️ INTENTO DE SETEAR empresa_id A NULL SIN force_unlink_entity: Lead {id}
   ```

---

### ✅ 6. Vincular Empresa (Botón "Vincular")

**Pasos:**
1. Abrir un lead que NO tenga `empresa_id` asignado
2. Ir a la pestaña "Entidad"
3. Ingresar un `empresa_id` válido en el campo
4. Hacer click en "Vincular"

**Resultado esperado:**
- ✅ Lead se actualiza correctamente
- ✅ `empresa_id` se asigna al lead
- ✅ Se muestra la información de la empresa vinculada

**Verificar en consola del servidor:**
```
[updateLeadSafe] Lead {id}: Actualizando empresa_id a {empresa_id} (cambio explícito)
```

---

### ✅ 7. Editar Lead Sin Cambiar empresa_id (Frontend)

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Editar cualquier campo (nombre, email, etc.)
3. NO modificar `empresa_id` en el formulario
4. Guardar cambios

**Resultado esperado:**
- ✅ Lead se actualiza correctamente
- ✅ `empresa_id` NO se incluye en el payload del request
- ✅ `empresa_id` se preserva en la DB
- ✅ En Network tab: el body NO incluye `empresa_id`

**Verificar en DevTools → Network:**
- Request PATCH a `/api/admin/leads/{id}`
- Body NO debe incluir `empresa_id`

---

### ✅ 8. Regenerar Módulo IA Individual

**Pasos:**
1. Abrir un lead que tenga `empresa_id` asignado
2. Ir a la pestaña "Informe IA"
3. Hacer click en "Regenerar este módulo" en cualquier tab

**Resultado esperado:**
- ✅ Módulo se regenera correctamente
- ✅ `empresa_id` se preserva (no cambia)
- ✅ No hay errores

---

## Verificación de Logs Temporales

Durante las pruebas, revisar los logs del servidor para detectar intentos de setear `empresa_id` a null:

```bash
# Buscar en logs:
grep "INTENTO DE SETEAR empresa_id A NULL" logs/*
```

Si aparece este log, significa que algún endpoint está intentando desvincular sin el flag requerido.

---

## Notas

- Los logs temporales están activos para detectar problemas
- Una vez confirmado que todo funciona, se pueden remover los logs de error (mantener los informativos)
- El flag `force_unlink_entity: true` solo debe usarse en casos excepcionales y con autorización explícita
