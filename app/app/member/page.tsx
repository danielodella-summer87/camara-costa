import { getSession, getDashboardPath } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function MemberHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["member", "staff", "admin", "superadmin"].includes(session.role)) redirect(getDashboardPath(session.role));

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Panel Member (Prototipo)</h1>
      <p className="text-sm text-neutral-500 mt-1">Sesión: {session.role}</p>
      <a className="underline mt-4 inline-block" href="/logout">Salir</a>
    </div>
  );
}
