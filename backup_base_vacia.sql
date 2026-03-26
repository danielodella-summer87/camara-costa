


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."import_batch_status" AS ENUM (
    'draft',
    'validated',
    'committed',
    'error'
);


ALTER TYPE "public"."import_batch_status" OWNER TO "postgres";


CREATE TYPE "public"."tipo_entidad" AS ENUM (
    'empresa',
    'profesional',
    'institucion'
);


ALTER TYPE "public"."tipo_entidad" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("p_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_users u
    join public.roles r on r.id = u.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where u.is_active is not false
      and (
        (u.auth_user_id is not null and u.auth_user_id = auth.uid())
        or (u.auth_user_id is null and u.id = auth.uid())
      )
      and p.key = p_key
  );
$$;


ALTER FUNCTION "public"."has_permission"("p_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."helpdesk_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."helpdesk_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."helpdesk_touch_ticket"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.helpdesk_tickets
    set updated_at = now(),
        last_activity_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."helpdesk_touch_ticket"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."lead_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "generation_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version_number" integer DEFAULT 1,
    "is_current" boolean DEFAULT true,
    "source" "text" DEFAULT 'gamma'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "gamma_url" "text",
    "file_url" "text",
    "notes" "text",
    "created_by" "text",
    "archived_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lead_documents_type_check" CHECK (("type" = ANY (ARRAY['diagnostic'::"text", 'strategy'::"text", 'proposal'::"text", 'presentation'::"text"])))
);


ALTER TABLE "public"."lead_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_lead_document_version"("p_lead_id" "uuid", "p_type" "text", "p_url" "text", "p_source" "text" DEFAULT 'gamma'::"text", "p_status" "text" DEFAULT 'archived'::"text", "p_gamma_url" "text" DEFAULT NULL::"text", "p_file_url" "text" DEFAULT NULL::"text", "p_generation_id" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_created_by" "text" DEFAULT NULL::"text", "p_archived_at" timestamp with time zone DEFAULT "now"()) RETURNS "public"."lead_documents"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_next_version integer;
  v_row public.lead_documents;
begin
  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.lead_documents
  where lead_id = p_lead_id
    and type = p_type;

  update public.lead_documents
  set is_current = false,
      updated_at = now()
  where lead_id = p_lead_id
    and type = p_type
    and is_current = true;

  insert into public.lead_documents (
    lead_id,
    type,
    url,
    source,
    status,
    gamma_url,
    file_url,
    generation_id,
    notes,
    created_by,
    archived_at,
    version_number,
    is_current,
    created_at,
    updated_at
  )
  values (
    p_lead_id,
    p_type,
    p_url,
    p_source,
    p_status,
    p_gamma_url,
    coalesce(p_file_url, p_url),
    p_generation_id,
    p_notes,
    p_created_by,
    p_archived_at,
    v_next_version,
    true,
    now(),
    now()
  )
  returning *
  into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."insert_lead_document_version"("p_lead_id" "uuid", "p_type" "text", "p_url" "text", "p_source" "text", "p_status" "text", "p_gamma_url" "text", "p_file_url" "text", "p_generation_id" "text", "p_notes" "text", "p_created_by" "text", "p_archived_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_users au
    join public.roles r on r.id = au.role_id
    where au.auth_user_id = auth.uid()
      and r.name = 'admin'::text
      and coalesce(au.is_active, true) = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_all_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Ajustá estos nombres a tus tablas reales
  truncate table
    public.socio_acciones,
    public.socios,
    public.leads,
    public.entidades
  restart identity cascade;
end;
$$;


ALTER FUNCTION "public"."reset_all_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_lead_documents"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_lead_documents"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_credentials" (
    "user_id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "must_change_password" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_credentials" IS 'Credenciales para login interno (username + password hash)';



CREATE TABLE IF NOT EXISTS "public"."app_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_sessions" IS 'Sesiones de auth interno (token_hash = SHA-256 del token en cookie)';



CREATE TABLE IF NOT EXISTS "public"."app_user_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "invited_by" "uuid"
);


ALTER TABLE "public"."app_user_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "nombre" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "comercial_id" "uuid",
    "invite_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "invited_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comerciales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "telefono" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "app_user_id" "uuid"
);


ALTER TABLE "public"."comerciales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config" (
    "key" "text" NOT NULL,
    "value" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."easy_service_deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."easy_service_deliverables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."easy_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text",
    "descripcion_corta" "text",
    "alcance_base" "text",
    "billing_type" "text" NOT NULL,
    "precio_base" numeric,
    "moneda" "text" DEFAULT 'USD'::"text",
    "activo" boolean DEFAULT true,
    "orden" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "recommended_for" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "easy_services_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['one_time'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."easy_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "rubro" "text",
    "estado" "text" DEFAULT 'Pendiente'::"text" NOT NULL,
    "descripcion" "text",
    "telefono" "text",
    "email" "text",
    "web" "text",
    "instagram" "text",
    "direccion" "text",
    "aprobada" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rubro_id" "uuid",
    "celular" "text",
    "rut" "text",
    "ciudad" "text",
    "pais" "text",
    "contacto_nombre" "text",
    "contacto_celular" "text",
    "contacto_email" "text",
    "etiquetas" "text"[],
    "tipo" "public"."tipo_entidad" DEFAULT 'empresa'::"public"."tipo_entidad" NOT NULL,
    "import_batch_id" "uuid",
    "facebook" "text"
);

ALTER TABLE ONLY "public"."empresas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concepto" "text" NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "inserted_rows" integer DEFAULT 0 NOT NULL,
    "error_rows" integer DEFAULT 0 NOT NULL,
    "filename" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "missing_rubros" "text",
    "notes" "text",
    "status" "text" DEFAULT 'draft'::"text"
);


ALTER TABLE "public"."entity_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "is_valid" boolean DEFAULT false NOT NULL,
    "errors" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."helpdesk_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" integer
);


ALTER TABLE "public"."helpdesk_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."helpdesk_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "body" "text" NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "user_email" "text"
);


ALTER TABLE "public"."helpdesk_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."helpdesk_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "admin_assignee" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "type" "text" DEFAULT 'bug'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "helpdesk_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "helpdesk_tickets_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'triage'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "helpdesk_tickets_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'improvement'::"text", 'suggestion'::"text"])))
);


ALTER TABLE "public"."helpdesk_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "cargo" "text",
    "telefono" "text",
    "email" "text",
    "linkedin" "text",
    "notas" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_docs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "file_bucket" "text" DEFAULT 'lead-docs'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "file_size" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."lead_docs" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_docs" IS 'Documentación PDF asociada a leads';



COMMENT ON COLUMN "public"."lead_docs"."file_bucket" IS 'Bucket de Supabase Storage donde se guarda el archivo';



COMMENT ON COLUMN "public"."lead_docs"."file_path" IS 'Ruta del archivo en el bucket';



CREATE TABLE IF NOT EXISTS "public"."lead_meet_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meet_session_id" "uuid" NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_meet_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_meet_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "meet_url" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "final_summary" "text",
    "final_next_step" "text",
    "final_score" integer,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_meet_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_meeting_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "meeting_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "emotional_state" "text",
    "conviction" smallint,
    "next_objective" "text",
    "checklist_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "lead_meeting_sessions_conviction_check" CHECK ((("conviction" IS NULL) OR (("conviction" >= 1) AND ("conviction" <= 5)))),
    CONSTRAINT "lead_meeting_sessions_emotional_check" CHECK ((("emotional_state" IS NULL) OR ("emotional_state" = ANY (ARRAY['rojo'::"text", 'amarillo'::"text", 'verde'::"text"])))),
    CONSTRAINT "lead_meeting_sessions_type_check" CHECK (("meeting_type" = ANY (ARRAY['descubrimiento'::"text", 'propuesta'::"text", 'cierre'::"text"])))
);


ALTER TABLE "public"."lead_meeting_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_picklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_picklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "notes" "text",
    "file_bucket" "text" DEFAULT 'lead-proposals'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "file_size" integer,
    "sent_at" timestamp with time zone
);


ALTER TABLE "public"."lead_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_service_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "precio" numeric(12,2),
    "moneda" "text" DEFAULT 'USD'::"text" NOT NULL,
    "alcance_editado" "text",
    "observaciones" "text",
    "origen" "text" DEFAULT 'manual'::"text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_service_proposals_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 24))),
    CONSTRAINT "lead_service_proposals_origen_check" CHECK (("origen" = ANY (ARRAY['manual'::"text", 'ia'::"text"])))
);


ALTER TABLE "public"."lead_service_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "contacto" "text",
    "telefono" "text",
    "email" "text",
    "origen" "text",
    "estado" "text" DEFAULT 'Nuevo'::"text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pipeline" "text",
    "rating" smallint DEFAULT 0 NOT NULL,
    "next_activity_type" "text",
    "next_activity_at" timestamp with time zone,
    "ai_context" "text",
    "ai_report" "text",
    "ai_report_updated_at" timestamp with time zone,
    "membership_goals" "text"[] DEFAULT '{}'::"text"[],
    "icp_targets" "text"[] DEFAULT '{}'::"text"[],
    "company_size" "text",
    "network_offer" "text",
    "website" "text",
    "objetivos" "jsonb",
    "audiencia" "jsonb",
    "tamano" "text",
    "oferta" "text",
    "linkedin_empresa" "text",
    "linkedin_director" "text",
    "is_member" boolean DEFAULT false,
    "member_since" timestamp with time zone,
    "empresa_id" "uuid",
    "score" smallint,
    "score_categoria" "text",
    "ai_custom_prompt" "text",
    "meet_url" "text",
    "comercial_id" "uuid" DEFAULT '3ceafb59-8e5a-478c-b534-1dc6f9b22583'::"uuid" NOT NULL,
    "socio_id" "text",
    "proposal_draft_json" "text",
    "proposal_confirmed_at" timestamp with time zone,
    "proposal_sent_at" timestamp with time zone,
    "instagram" "text",
    "direccion" "text",
    "proposal_doc_url" "text",
    "presentation_doc_url" "text",
    "proposal_reviewed" boolean DEFAULT false,
    "commercial_stage" "text",
    CONSTRAINT "leads_next_activity_type_allowed" CHECK ((("next_activity_type" IS NULL) OR ("next_activity_type" = ANY (ARRAY['none'::"text", 'call'::"text", 'meeting'::"text", 'proposal'::"text", 'whatsapp'::"text", 'email'::"text", 'followup'::"text"])))),
    CONSTRAINT "leads_rating_range" CHECK ((("rating" >= 0) AND ("rating" <= 5))),
    CONSTRAINT "leads_score_range" CHECK ((("score" IS NULL) OR (("score" >= 0) AND ("score" <= 10))))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."ai_custom_prompt" IS 'Personalización opcional escrita por el usuario para el informe IA del lead';



COMMENT ON COLUMN "public"."leads"."meet_url" IS 'Google Meet URL para sesión asistida por IA';



COMMENT ON COLUMN "public"."leads"."proposal_sent_at" IS 'Fecha en que se marcó la propuesta como enviada al cliente; null = aún no enviada.';



CREATE TABLE IF NOT EXISTS "public"."leads_pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nombre" "text" NOT NULL,
    "posicion" integer DEFAULT 0 NOT NULL,
    "color" "text",
    "tipo" "text" DEFAULT 'normal'::"text" NOT NULL,
    "orden" integer DEFAULT 9999 NOT NULL,
    CONSTRAINT "leads_pipelines_tipo_chk" CHECK (("tipo" = ANY (ARRAY['normal'::"text", 'ganado'::"text", 'perdido'::"text"])))
);


ALTER TABLE "public"."leads_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "module" "text" NOT NULL,
    "action" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cedula" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "role" "text" NOT NULL,
    "chamber_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'staff'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."socio_acciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "socio_id" "text",
    "tipo" "text" NOT NULL,
    "nota" "text",
    "realizada_at" timestamp with time zone,
    "creada_por" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lead_id" "uuid",
    "fecha_limite" "date",
    "lugar" "text",
    "comercial_id" "uuid",
    "hora" "text" DEFAULT '00:00'::"text" NOT NULL,
    "invited_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "socio_acciones_socio_or_lead_check" CHECK (((("socio_id" IS NOT NULL) AND ("lead_id" IS NULL)) OR (("socio_id" IS NULL) AND ("lead_id" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."socio_acciones" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."socio_acciones" OWNER TO "postgres";


COMMENT ON COLUMN "public"."socio_acciones"."realizada_at" IS 'Timestamp de cuando se ejecutó la acción. NULL si está pendiente. Se setea cuando se marca como ejecutada.';



COMMENT ON COLUMN "public"."socio_acciones"."lead_id" IS 'Referencia al lead asociado. NULL si la acción pertenece a un socio.';



COMMENT ON COLUMN "public"."socio_acciones"."fecha_limite" IS 'Fecha límite (deadline) para ejecutar la acción. NULL si no está definida.';



COMMENT ON COLUMN "public"."socio_acciones"."lugar" IS 'Lugar/dirección para la actividad. Se usa para abrir Google Maps / Waze.';



COMMENT ON CONSTRAINT "socio_acciones_socio_or_lead_check" ON "public"."socio_acciones" IS 'Una acción debe pertenecer a un socio O a un lead, pero no a ambos.';



CREATE TABLE IF NOT EXISTS "public"."socios" (
    "id" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "plan" "text" NOT NULL,
    "estado" "text" NOT NULL,
    "fecha_alta" "date" NOT NULL,
    "email" "text",
    "telefono" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lead_id" "uuid",
    "proxima_accion" "text",
    "empresa_id" "uuid",
    "codigo" "text"
);

ALTER TABLE ONLY "public"."socios" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."socios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_socio_inteligente" AS
 WITH "ult" AS (
         SELECT "sa"."socio_id",
            "max"("sa"."realizada_at") AS "ultima_accion_at",
            "count"(*) FILTER (WHERE ("sa"."realizada_at" >= ("now"() - '30 days'::interval))) AS "acciones_30d"
           FROM "public"."socio_acciones" "sa"
          GROUP BY "sa"."socio_id"
        ), "src" AS (
         SELECT "s"."id",
            "s"."nombre",
            "s"."plan",
            "s"."estado",
            "s"."fecha_alta",
            "s"."email",
            "s"."telefono",
            "s"."notas",
            "s"."created_at",
            "ult"."ultima_accion_at",
            COALESCE("ult"."acciones_30d", (0)::bigint) AS "acciones_30d",
            COALESCE("ult"."ultima_accion_at", ("s"."fecha_alta")::timestamp with time zone) AS "last_contact_at"
           FROM ("public"."socios" "s"
             LEFT JOIN "ult" ON (("ult"."socio_id" = "s"."id")))
        )
 SELECT "id",
    "nombre",
    "plan",
    "estado",
    "fecha_alta" AS "alta",
    "email",
    "telefono",
    "notas",
    "ultima_accion_at",
    "acciones_30d",
    GREATEST(0, ("floor"((EXTRACT(epoch FROM ("now"() - "last_contact_at")) / (86400)::numeric)))::integer) AS "dias_sin_contacto",
        CASE
            WHEN ("estado" = 'Vencido'::"text") THEN 'rojo'::"text"
            WHEN (("estado" = 'Activo'::"text") AND ("acciones_30d" = 0)) THEN 'amarillo'::"text"
            WHEN ("last_contact_at" < ("now"() - '21 days'::interval)) THEN 'rojo'::"text"
            WHEN ("last_contact_at" < ("now"() - '10 days'::interval)) THEN 'amarillo'::"text"
            ELSE 'verde'::"text"
        END AS "semaforo",
        CASE
            WHEN ("estado" = 'Vencido'::"text") THEN 'Recuperación: llamada + propuesta'::"text"
            WHEN (("estado" = 'Activo'::"text") AND ("acciones_30d" = 0)) THEN 'Seguimiento: agendar contacto'::"text"
            WHEN ("last_contact_at" < ("now"() - '21 days'::interval)) THEN 'Urgente: retomar contacto hoy'::"text"
            WHEN ("last_contact_at" < ("now"() - '10 days'::interval)) THEN 'Seguimiento: agendar contacto'::"text"
            WHEN ("acciones_30d" = 0) THEN 'Activar: primera acción comercial'::"text"
            ELSE 'OK: mantener cadencia'::"text"
        END AS "proxima_accion"
   FROM "src";


ALTER VIEW "public"."v_socio_inteligente" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_credentials"
    ADD CONSTRAINT "app_credentials_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."app_credentials"
    ADD CONSTRAINT "app_credentials_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."app_user_invites"
    ADD CONSTRAINT "app_user_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comerciales"
    ADD CONSTRAINT "comerciales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config"
    ADD CONSTRAINT "config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."easy_service_deliverables"
    ADD CONSTRAINT "easy_service_deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."easy_services"
    ADD CONSTRAINT "easy_services_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."easy_services"
    ADD CONSTRAINT "easy_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_import_batches"
    ADD CONSTRAINT "entity_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_import_rows"
    ADD CONSTRAINT "entity_import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."helpdesk_attachments"
    ADD CONSTRAINT "helpdesk_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."helpdesk_comments"
    ADD CONSTRAINT "helpdesk_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."helpdesk_tickets"
    ADD CONSTRAINT "helpdesk_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_contacts"
    ADD CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_docs"
    ADD CONSTRAINT "lead_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_lead_id_type_key" UNIQUE ("lead_id", "type");



COMMENT ON CONSTRAINT "lead_documents_lead_id_type_key" ON "public"."lead_documents" IS 'Un solo documento vigente por lead y tipo (diagnostic, strategy, proposal).';



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_meet_events"
    ADD CONSTRAINT "lead_meet_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_meet_sessions"
    ADD CONSTRAINT "lead_meet_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_meeting_sessions"
    ADD CONSTRAINT "lead_meeting_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_picklist_items"
    ADD CONSTRAINT "lead_picklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_pipelines"
    ADD CONSTRAINT "lead_pipelines_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."lead_pipelines"
    ADD CONSTRAINT "lead_pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_proposals"
    ADD CONSTRAINT "lead_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_service_proposals"
    ADD CONSTRAINT "lead_service_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_pipelines"
    ADD CONSTRAINT "leads_pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_cedula_key" UNIQUE ("cedula");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."socio_acciones"
    ADD CONSTRAINT "socio_acciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_lead_id_unique" UNIQUE ("lead_id");



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "app_user_invites_email_lower_uniq" ON "public"."app_user_invites" USING "btree" ("lower"("email"));



CREATE INDEX "app_users_email_idx" ON "public"."app_users" USING "btree" ("email");



CREATE UNIQUE INDEX "app_users_email_lower_ux" ON "public"."app_users" USING "btree" ("lower"("email"));



CREATE INDEX "comerciales_activo_idx" ON "public"."comerciales" USING "btree" ("activo");



CREATE INDEX "easy_service_deliverables_orden_idx" ON "public"."easy_service_deliverables" USING "btree" ("service_id", "orden");



CREATE INDEX "easy_service_deliverables_service_id_idx" ON "public"."easy_service_deliverables" USING "btree" ("service_id");



CREATE INDEX "easy_services_activo_idx" ON "public"."easy_services" USING "btree" ("activo");



CREATE INDEX "easy_services_categoria_idx" ON "public"."easy_services" USING "btree" ("categoria");



CREATE INDEX "easy_services_orden_idx" ON "public"."easy_services" USING "btree" ("orden");



CREATE INDEX "helpdesk_attachments_ticket_id_idx" ON "public"."helpdesk_attachments" USING "btree" ("ticket_id", "created_at");



CREATE INDEX "helpdesk_comments_ticket_id_idx" ON "public"."helpdesk_comments" USING "btree" ("ticket_id", "created_at");



CREATE INDEX "helpdesk_tickets_created_by_idx" ON "public"."helpdesk_tickets" USING "btree" ("created_by");



CREATE INDEX "helpdesk_tickets_last_activity_idx" ON "public"."helpdesk_tickets" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "helpdesk_tickets_priority_idx" ON "public"."helpdesk_tickets" USING "btree" ("priority");



CREATE INDEX "helpdesk_tickets_status_idx" ON "public"."helpdesk_tickets" USING "btree" ("status");



CREATE INDEX "idx_app_sessions_expires_at" ON "public"."app_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_app_sessions_token_hash" ON "public"."app_sessions" USING "btree" ("token_hash");



CREATE INDEX "idx_app_sessions_user_id" ON "public"."app_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_app_users_comercial_id" ON "public"."app_users" USING "btree" ("comercial_id");



CREATE INDEX "idx_app_users_is_active" ON "public"."app_users" USING "btree" ("is_active");



CREATE INDEX "idx_app_users_role_id" ON "public"."app_users" USING "btree" ("role_id");



CREATE INDEX "idx_comerciales_app_user_id" ON "public"."comerciales" USING "btree" ("app_user_id");



CREATE INDEX "idx_comerciales_user_id" ON "public"."comerciales" USING "btree" ("user_id");



CREATE INDEX "idx_entity_import_rows_batch" ON "public"."entity_import_rows" USING "btree" ("batch_id");



CREATE INDEX "idx_lead_docs_created_at" ON "public"."lead_docs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lead_docs_lead_id" ON "public"."lead_docs" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_documents_created_at" ON "public"."lead_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lead_documents_lead_id" ON "public"."lead_documents" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_documents_lead_type" ON "public"."lead_documents" USING "btree" ("lead_id", "type");



CREATE INDEX "idx_lead_documents_lead_type_current" ON "public"."lead_documents" USING "btree" ("lead_id", "type", "is_current");



CREATE INDEX "idx_lead_meeting_sessions_lead" ON "public"."lead_meeting_sessions" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_meeting_sessions_type" ON "public"."lead_meeting_sessions" USING "btree" ("meeting_type");



CREATE INDEX "idx_leads_empresa_id" ON "public"."leads" USING "btree" ("empresa_id");



CREATE INDEX "idx_leads_is_member" ON "public"."leads" USING "btree" ("is_member");



CREATE INDEX "idx_leads_socio_id" ON "public"."leads" USING "btree" ("socio_id");



CREATE INDEX "idx_socio_acciones_fecha_limite" ON "public"."socio_acciones" USING "btree" ("fecha_limite");



CREATE INDEX "idx_socio_acciones_fecha_limite_pendientes" ON "public"."socio_acciones" USING "btree" ("fecha_limite", "realizada_at") WHERE ("realizada_at" IS NULL);



CREATE INDEX "idx_socio_acciones_invited_user_ids" ON "public"."socio_acciones" USING "gin" ("invited_user_ids");



CREATE INDEX "idx_socio_acciones_lead_created" ON "public"."socio_acciones" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_socio_acciones_lead_fecha_limite" ON "public"."socio_acciones" USING "btree" ("lead_id", "fecha_limite") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_socio_acciones_lead_id" ON "public"."socio_acciones" USING "btree" ("lead_id");



CREATE INDEX "idx_socio_acciones_lugar" ON "public"."socio_acciones" USING "btree" ("lugar");



CREATE INDEX "idx_socio_acciones_realizada_at" ON "public"."socio_acciones" USING "btree" ("realizada_at" DESC);



CREATE INDEX "idx_socio_acciones_socio_fecha_limite" ON "public"."socio_acciones" USING "btree" ("socio_id", "fecha_limite") WHERE ("socio_id" IS NOT NULL);



CREATE INDEX "idx_socio_acciones_socio_id" ON "public"."socio_acciones" USING "btree" ("socio_id");



CREATE INDEX "idx_socios_empresa_id" ON "public"."socios" USING "btree" ("empresa_id");



CREATE INDEX "idx_socios_lead_id" ON "public"."socios" USING "btree" ("lead_id");



CREATE INDEX "lead_contacts_lead_id_idx" ON "public"."lead_contacts" USING "btree" ("lead_id");



CREATE INDEX "lead_contacts_primary_idx" ON "public"."lead_contacts" USING "btree" ("lead_id", "is_primary");



CREATE INDEX "lead_meet_events_session_created_idx" ON "public"."lead_meet_events" USING "btree" ("meet_session_id", "created_at" DESC);



CREATE INDEX "lead_meet_events_session_id_idx" ON "public"."lead_meet_events" USING "btree" ("meet_session_id");



CREATE INDEX "lead_meet_events_type_idx" ON "public"."lead_meet_events" USING "btree" ("type");



CREATE INDEX "lead_meet_sessions_lead_id_idx" ON "public"."lead_meet_sessions" USING "btree" ("lead_id");



CREATE INDEX "lead_meet_sessions_status_idx" ON "public"."lead_meet_sessions" USING "btree" ("status");



CREATE INDEX "lead_picklist_items_group_sort_idx" ON "public"."lead_picklist_items" USING "btree" ("group_key", "sort");



CREATE INDEX "lead_pipelines_sort_idx" ON "public"."lead_pipelines" USING "btree" ("is_active", "sort_order");



CREATE INDEX "lead_proposals_created_at_idx" ON "public"."lead_proposals" USING "btree" ("created_at" DESC);



CREATE INDEX "lead_proposals_lead_id_idx" ON "public"."lead_proposals" USING "btree" ("lead_id");



CREATE INDEX "lead_service_proposals_lead_id_idx" ON "public"."lead_service_proposals" USING "btree" ("lead_id");



CREATE INDEX "lead_service_proposals_lead_idx" ON "public"."lead_service_proposals" USING "btree" ("lead_id");



CREATE INDEX "lead_service_proposals_lead_mes_idx" ON "public"."lead_service_proposals" USING "btree" ("lead_id", "mes", "orden");



CREATE INDEX "lead_service_proposals_mes_idx" ON "public"."lead_service_proposals" USING "btree" ("lead_id", "mes");



CREATE INDEX "lead_service_proposals_service_id_idx" ON "public"."lead_service_proposals" USING "btree" ("service_id");



CREATE INDEX "lead_service_proposals_service_idx" ON "public"."lead_service_proposals" USING "btree" ("service_id");



CREATE INDEX "leads_created_at_idx" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "leads_pipeline_idx" ON "public"."leads" USING "btree" ("pipeline");



CREATE UNIQUE INDEX "leads_pipelines_nombre_uq" ON "public"."leads_pipelines" USING "btree" ("lower"("nombre"));



CREATE INDEX "leads_pipelines_orden_idx" ON "public"."leads_pipelines" USING "btree" ("orden");



CREATE INDEX "leads_pipelines_posicion_idx" ON "public"."leads_pipelines" USING "btree" ("posicion");



CREATE INDEX "profiles_cedula_idx" ON "public"."profiles" USING "btree" ("cedula");



CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "rubros_activo_idx" ON "public"."rubros" USING "btree" ("activo");



CREATE UNIQUE INDEX "rubros_nombre_lower_uidx" ON "public"."rubros" USING "btree" ("lower"("nombre"));



CREATE UNIQUE INDEX "socios_codigo_unique" ON "public"."socios" USING "btree" ("codigo") WHERE ("codigo" IS NOT NULL);



CREATE UNIQUE INDEX "uq_lead_documents_current_per_type" ON "public"."lead_documents" USING "btree" ("lead_id", "type") WHERE ("is_current" = true);



CREATE OR REPLACE TRIGGER "trg_config_updated_at" BEFORE UPDATE ON "public"."config" FOR EACH ROW EXECUTE FUNCTION "public"."set_config_updated_at"();



CREATE OR REPLACE TRIGGER "trg_easy_services_updated_at" BEFORE UPDATE ON "public"."easy_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_empresas_updated_at" BEFORE UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_entity_import_batches_updated_at" BEFORE UPDATE ON "public"."entity_import_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_helpdesk_attachments_touch" AFTER INSERT ON "public"."helpdesk_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."helpdesk_touch_ticket"();



CREATE OR REPLACE TRIGGER "trg_helpdesk_comments_touch" AFTER INSERT ON "public"."helpdesk_comments" FOR EACH ROW EXECUTE FUNCTION "public"."helpdesk_touch_ticket"();



CREATE OR REPLACE TRIGGER "trg_helpdesk_tickets_updated_at" BEFORE UPDATE ON "public"."helpdesk_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."helpdesk_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lead_contacts_updated_at" BEFORE UPDATE ON "public"."lead_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lead_pipelines_updated_at" BEFORE UPDATE ON "public"."lead_pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lead_service_proposals_updated_at" BEFORE UPDATE ON "public"."lead_service_proposals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leads_pipelines_updated_at" BEFORE UPDATE ON "public"."leads_pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rubros_updated_at" BEFORE UPDATE ON "public"."rubros" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at_lead_documents" BEFORE UPDATE ON "public"."lead_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_lead_documents"();



ALTER TABLE ONLY "public"."app_credentials"
    ADD CONSTRAINT "app_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_comercial_id_fkey" FOREIGN KEY ("comercial_id") REFERENCES "public"."comerciales"("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."comerciales"
    ADD CONSTRAINT "comerciales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."easy_service_deliverables"
    ADD CONSTRAINT "easy_service_deliverables_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."easy_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "public"."entity_import_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id");



ALTER TABLE ONLY "public"."entity_import_rows"
    ADD CONSTRAINT "entity_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."entity_import_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "fk_leads_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "fk_socios_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."helpdesk_attachments"
    ADD CONSTRAINT "helpdesk_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."helpdesk_attachments"
    ADD CONSTRAINT "helpdesk_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."helpdesk_comments"
    ADD CONSTRAINT "helpdesk_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."helpdesk_comments"
    ADD CONSTRAINT "helpdesk_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."helpdesk_tickets"
    ADD CONSTRAINT "helpdesk_tickets_admin_assignee_fkey" FOREIGN KEY ("admin_assignee") REFERENCES "public"."app_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."helpdesk_tickets"
    ADD CONSTRAINT "helpdesk_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lead_contacts"
    ADD CONSTRAINT "lead_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_docs"
    ADD CONSTRAINT "lead_docs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_meet_events"
    ADD CONSTRAINT "lead_meet_events_meet_session_id_fkey" FOREIGN KEY ("meet_session_id") REFERENCES "public"."lead_meet_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_meet_sessions"
    ADD CONSTRAINT "lead_meet_sessions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_meeting_sessions"
    ADD CONSTRAINT "lead_meeting_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."lead_meeting_sessions"
    ADD CONSTRAINT "lead_meeting_sessions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_proposals"
    ADD CONSTRAINT "lead_proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_service_proposals"
    ADD CONSTRAINT "lead_service_proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_service_proposals"
    ADD CONSTRAINT "lead_service_proposals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."easy_services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_comercial_id_fkey" FOREIGN KEY ("comercial_id") REFERENCES "public"."comerciales"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."socio_acciones"
    ADD CONSTRAINT "socio_acciones_comercial_id_fkey" FOREIGN KEY ("comercial_id") REFERENCES "public"."comerciales"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."socio_acciones"
    ADD CONSTRAINT "socio_acciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."socio_acciones"
    ADD CONSTRAINT "socio_acciones_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_users_admin_delete" ON "public"."app_users" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "app_users_admin_insert" ON "public"."app_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "app_users_admin_select" ON "public"."app_users" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "app_users_admin_update" ON "public"."app_users" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "app_users_read_own" ON "public"."app_users" FOR SELECT USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "app_users_select_own" ON "public"."app_users" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresas_delete" ON "public"."empresas" FOR DELETE TO "authenticated" USING ("public"."has_permission"('empresas.delete'::"text"));



CREATE POLICY "empresas_insert" ON "public"."empresas" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('empresas.write'::"text"));



CREATE POLICY "empresas_read" ON "public"."empresas" FOR SELECT TO "authenticated" USING ("public"."has_permission"('empresas.read'::"text"));



CREATE POLICY "empresas_update" ON "public"."empresas" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('empresas.write'::"text")) WITH CHECK ("public"."has_permission"('empresas.write'::"text"));



ALTER TABLE "public"."lead_picklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_select_all" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."socio_acciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."socios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "svc_delete_acciones" ON "public"."socio_acciones" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "svc_delete_empresas" ON "public"."empresas" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "svc_insert_acciones" ON "public"."socio_acciones" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "svc_insert_empresas" ON "public"."empresas" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "svc_select_acciones" ON "public"."socio_acciones" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "svc_select_empresas" ON "public"."empresas" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "svc_select_socios" ON "public"."socios" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "svc_update_empresas" ON "public"."empresas" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."has_permission"("p_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("p_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("p_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."helpdesk_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."helpdesk_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."helpdesk_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."helpdesk_touch_ticket"() TO "anon";
GRANT ALL ON FUNCTION "public"."helpdesk_touch_ticket"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."helpdesk_touch_ticket"() TO "service_role";



GRANT ALL ON TABLE "public"."lead_documents" TO "anon";
GRANT ALL ON TABLE "public"."lead_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_documents" TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_lead_document_version"("p_lead_id" "uuid", "p_type" "text", "p_url" "text", "p_source" "text", "p_status" "text", "p_gamma_url" "text", "p_file_url" "text", "p_generation_id" "text", "p_notes" "text", "p_created_by" "text", "p_archived_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_lead_document_version"("p_lead_id" "uuid", "p_type" "text", "p_url" "text", "p_source" "text", "p_status" "text", "p_gamma_url" "text", "p_file_url" "text", "p_generation_id" "text", "p_notes" "text", "p_created_by" "text", "p_archived_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_lead_document_version"("p_lead_id" "uuid", "p_type" "text", "p_url" "text", "p_source" "text", "p_status" "text", "p_gamma_url" "text", "p_file_url" "text", "p_generation_id" "text", "p_notes" "text", "p_created_by" "text", "p_archived_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_all_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_all_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_all_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_all_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_lead_documents"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_lead_documents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_lead_documents"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_credentials" TO "anon";
GRANT ALL ON TABLE "public"."app_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."app_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."app_sessions" TO "anon";
GRANT ALL ON TABLE "public"."app_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."app_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."app_user_invites" TO "anon";
GRANT ALL ON TABLE "public"."app_user_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user_invites" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."comerciales" TO "anon";
GRANT ALL ON TABLE "public"."comerciales" TO "authenticated";
GRANT ALL ON TABLE "public"."comerciales" TO "service_role";



GRANT ALL ON TABLE "public"."config" TO "anon";
GRANT ALL ON TABLE "public"."config" TO "authenticated";
GRANT ALL ON TABLE "public"."config" TO "service_role";



GRANT ALL ON TABLE "public"."easy_service_deliverables" TO "anon";
GRANT ALL ON TABLE "public"."easy_service_deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."easy_service_deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."easy_services" TO "anon";
GRANT ALL ON TABLE "public"."easy_services" TO "authenticated";
GRANT ALL ON TABLE "public"."easy_services" TO "service_role";



GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";



GRANT ALL ON TABLE "public"."entity_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."entity_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."entity_import_rows" TO "anon";
GRANT ALL ON TABLE "public"."entity_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."helpdesk_attachments" TO "anon";
GRANT ALL ON TABLE "public"."helpdesk_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."helpdesk_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."helpdesk_comments" TO "anon";
GRANT ALL ON TABLE "public"."helpdesk_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."helpdesk_comments" TO "service_role";



GRANT ALL ON TABLE "public"."helpdesk_tickets" TO "anon";
GRANT ALL ON TABLE "public"."helpdesk_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."helpdesk_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."lead_contacts" TO "anon";
GRANT ALL ON TABLE "public"."lead_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."lead_docs" TO "anon";
GRANT ALL ON TABLE "public"."lead_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_docs" TO "service_role";



GRANT ALL ON TABLE "public"."lead_meet_events" TO "anon";
GRANT ALL ON TABLE "public"."lead_meet_events" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_meet_events" TO "service_role";



GRANT ALL ON TABLE "public"."lead_meet_sessions" TO "anon";
GRANT ALL ON TABLE "public"."lead_meet_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_meet_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."lead_meeting_sessions" TO "anon";
GRANT ALL ON TABLE "public"."lead_meeting_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_meeting_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."lead_picklist_items" TO "anon";
GRANT ALL ON TABLE "public"."lead_picklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_picklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."lead_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."lead_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."lead_proposals" TO "anon";
GRANT ALL ON TABLE "public"."lead_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."lead_service_proposals" TO "anon";
GRANT ALL ON TABLE "public"."lead_service_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_service_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."leads_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."leads_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."rubros" TO "anon";
GRANT ALL ON TABLE "public"."rubros" TO "authenticated";
GRANT ALL ON TABLE "public"."rubros" TO "service_role";



GRANT ALL ON TABLE "public"."socio_acciones" TO "anon";
GRANT ALL ON TABLE "public"."socio_acciones" TO "authenticated";
GRANT ALL ON TABLE "public"."socio_acciones" TO "service_role";



GRANT ALL ON TABLE "public"."socios" TO "anon";
GRANT ALL ON TABLE "public"."socios" TO "authenticated";
GRANT ALL ON TABLE "public"."socios" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_socio_inteligente" TO "anon";
GRANT ALL ON TABLE "public"."v_socio_inteligente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_socio_inteligente" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































