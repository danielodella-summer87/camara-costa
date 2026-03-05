This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Invitaciones (Google-only)

El sistema de invitación no usa Supabase Auth; crea/actualiza usuarios en `app_users` (allowlist + rol) y envía un email informativo con Resend. El usuario ingresa con "Continuar con Google".

### Migración de base de datos (ejecutar en Supabase, no en el repo)

```sql
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS invited_at timestamptz,
ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS app_users_email_idx ON public.app_users (email);
```

### Variables de entorno

Configurar en Vercel y en `.env.local`:

- `RESEND_API_KEY` — API key de Resend
- `MAIL_FROM` — Remitente del correo (ej: `"Cámara Costa <no-reply@tudominio.com>"`)
- `APP_URL` — URL base de la app (ej: `https://camara-costa.vercel.app`)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role de Supabase (ya usado en el proyecto)

### Endpoints

- `POST /api/admin/users/invite` — Crea/actualiza usuario en `app_users` y envía email de invitación. Body: `{ email, nombre?, role_id, role_name? }`
- `POST /api/admin/users/resend-invite` — Reenvía el email de invitación. Body: `{ email, role_name? }`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
