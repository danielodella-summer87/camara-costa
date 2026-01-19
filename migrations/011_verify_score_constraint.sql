-- ============================================
-- VERIFICAR constraint REAL de score en leads
-- ============================================
-- Ejecutar este query en Supabase SQL Editor para ver los constraints actuales

SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'leads'
  AND c.contype = 'c'  -- 'c' = CHECK constraint
ORDER BY conname;

-- ============================================
-- QUÉ BUSCAR:
-- ============================================
-- ✅ CORRECTO: CHECK ((score IS NULL) OR ((score >= 0) AND (score <= 10)))
-- ❌ INCORRECTO: CHECK ((score >= 1) AND (score <= 5))
-- ❌ INCORRECTO: CHECK ((score >= 0) AND (score <= 5))
-- 
-- Si ves un constraint con rango 1-5 o 0-5, necesitas ejecutar:
-- migrations/010_fix_score_range_0_to_10.sql
