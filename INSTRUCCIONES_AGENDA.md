# Instrucciones para Implementar Agenda

## ✅ Archivos Creados/Modificados

### Archivos Nuevos:
1. `app/api/admin/agenda/route.ts` - Endpoint GET para obtener acciones pendientes
2. `app/admin/agenda/page.tsx` - Página de Agenda con vista estilo Google Calendar

### Archivos Modificados:
1. `components/shell/Sidebar.tsx` - Agregado link "Agenda" en el sidebar

---

## 📋 Instrucciones por TERMINAL

### 1. Verificar que los archivos estén creados

```bash
# Verificar endpoint
ls -la app/api/admin/agenda/route.ts

# Verificar página
ls -la app/admin/agenda/page.tsx

# Verificar sidebar modificado
grep -n "Agenda" components/shell/Sidebar.tsx
```

### 2. Verificar que no haya errores de TypeScript

```bash
# Desde la raíz del proyecto
npm run build
# O si usas tsx/ts-node
npx tsc --noEmit
```

### 3. Probar el endpoint manualmente (opcional)

```bash
# Si tienes el servidor corriendo
curl http://localhost:3000/api/admin/agenda
```

---

## 📋 Instrucciones por CURSOR

### 1. Verificar estructura de la tabla `socio_acciones`

Asegúrate de que la tabla tenga:
- `realizada_at` (puede ser NULL, fecha YYYY-MM-DD, o timestamp ISO)
- `lead_id` (UUID, nullable)
- `socio_id` (UUID, nullable)
- `tipo` (string)
- `nota` (string, nullable)
- `created_at` (timestamp)

### 2. Verificar que los joins funcionen

El endpoint hace joins con:
- `leads:lead_id(nombre)` - para obtener nombre del lead
- `socios:socio_id(nombre)` - para obtener nombre del socio

Si los nombres de las tablas o relaciones son diferentes, ajustar en:
- `app/api/admin/agenda/route.ts` líneas 64 y 82

### 3. Ajustar lógica de "ejecutada" si es necesario

La lógica actual determina si una acción está ejecutada así:
- Si `realizada_at` contiene 'T' o tiene más de 10 caracteres → está ejecutada (timestamp ISO)
- Si `realizada_at` es NULL o es YYYY-MM-DD (10 caracteres) → está pendiente (fecha límite)

Si tu sistema usa otro campo (ej: `done`, `done_at`), ajustar la función `isActionExecuted` en:
- `app/api/admin/agenda/route.ts` líneas 107-111

### 4. Verificar rango de fechas

El endpoint filtra por defecto:
- **Desde**: Hoy (incluyendo vencidas)
- **Hasta**: +14 días desde hoy

Si necesitas cambiar el rango, modificar en:
- `app/api/admin/agenda/route.ts` línea 42: `endDate.setDate(endDate.getDate() + 14)`

### 5. Ajustar estilos si es necesario

La página usa Tailwind CSS. Si necesitas ajustar colores o estilos:
- `app/admin/agenda/page.tsx` - función `getTipoColor` (línea ~100)
- `app/admin/agenda/page.tsx` - clases de encabezados sticky (línea ~150)

---

## 🧪 Pruebas Recomendadas

### 1. Crear acciones de prueba

```sql
-- Acción de lead para hoy
INSERT INTO socio_acciones (lead_id, socio_id, tipo, nota, realizada_at, created_at)
VALUES ('<lead_id>', NULL, 'llamada', 'Test agenda', CURRENT_DATE, NOW());

-- Acción de socio para mañana
INSERT INTO socio_acciones (lead_id, socio_id, tipo, nota, realizada_at, created_at)
VALUES (NULL, '<socio_id>', 'email', 'Test agenda', CURRENT_DATE + INTERVAL '1 day', NOW());

-- Acción vencida (ayer)
INSERT INTO socio_acciones (lead_id, socio_id, tipo, nota, realizada_at, created_at)
VALUES ('<lead_id>', NULL, 'whatsapp', 'Test vencida', CURRENT_DATE - INTERVAL '1 day', NOW());
```

### 2. Verificar en la UI

1. Abrir `/admin/agenda`
2. Verificar que aparezcan las acciones agrupadas por día
3. Verificar que las vencidas muestren badge "Vencida"
4. Verificar que los links a lead/socio funcionen
5. Verificar que el sidebar tenga el link "Agenda"

### 3. Verificar endpoint

```bash
# Desde DevTools Network o curl
GET /api/admin/agenda

# Debe retornar:
{
  "data": [
    {
      "id": "...",
      "tipo": "llamada",
      "fecha_limite": "2025-01-25",
      "nota": "...",
      "created_at": "...",
      "lead_id": "...",
      "socio_id": null,
      "owner_type": "lead",
      "owner_name": "Nombre del Lead"
    },
    ...
  ],
  "error": null
}
```

---

## 🔧 Ajustes Opcionales

### Cambiar rango de fechas

En `app/api/admin/agenda/route.ts`:
```typescript
// Cambiar de 14 a 30 días
endDate.setDate(endDate.getDate() + 30);
```

### Agregar filtros adicionales

En `app/admin/agenda/page.tsx`, agregar estado para filtros:
```typescript
const [filterTipo, setFilterTipo] = useState<string | null>(null);
const [filterOwner, setFilterOwner] = useState<"all" | "lead" | "socio">("all");
```

### Agregar paginación

Si hay muchas acciones, agregar paginación en el endpoint y UI.

---

## ✅ Checklist Final

- [ ] Endpoint `/api/admin/agenda` responde correctamente
- [ ] Página `/admin/agenda` se renderiza sin errores
- [ ] Link "Agenda" aparece en el sidebar
- [ ] Acciones se agrupan correctamente por día
- [ ] Encabezados de día son sticky
- [ ] Acciones vencidas muestran badge "Vencida"
- [ ] Links a lead/socio funcionan correctamente
- [ ] No se rompen las vistas existentes de Acciones

---

## 📝 Notas

- El endpoint filtra automáticamente acciones ejecutadas (solo muestra pendientes)
- Incluye acciones vencidas (antes de hoy) en el rango
- Los encabezados de día son sticky para mejor UX al hacer scroll
- Cada acción es clickeable y lleva a la ficha del lead/socio correspondiente
