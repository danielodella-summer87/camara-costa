import Link from "next/link";

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const reasonRaw = searchParams?.reason;
  const reason = Array.isArray(reasonRaw) ? reasonRaw[0] : reasonRaw;

  const emailRaw = searchParams?.email;
  const email = Array.isArray(emailRaw) ? emailRaw[0] : emailRaw;

  const uidRaw = searchParams?.uid;
  const uid = Array.isArray(uidRaw) ? uidRaw[0] : uidRaw;

  const extraRaw = searchParams?.extra;
  const extra = Array.isArray(extraRaw) ? extraRaw[0] : extraRaw;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-xl w-full rounded-2xl border bg-white p-8 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">403 • Sin permisos</h1>

        <p className="text-slate-700">
          No tenés permisos para acceder a esta sección.
          <br />
          Si creés que deberías tener acceso, contactá al administrador.
        </p>

        {(reason || email || uid || extra) && (
          <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
            {reason ? (
              <div>
                <span className="font-semibold">Reason:</span> {reason}
              </div>
            ) : null}
            {email ? (
              <div>
                <span className="font-semibold">Email:</span> {email}
              </div>
            ) : null}
            {uid ? (
              <div>
                <span className="font-semibold">UID:</span> {uid}
              </div>
            ) : null}
            {extra ? (
              <div>
                <span className="font-semibold">Extra:</span> {extra}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/admin"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Volver al Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            Ir a Login
          </Link>
        </div>
      </div>
    </div>
  );
}
