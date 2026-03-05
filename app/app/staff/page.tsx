import { getSession, getDashboardPath } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function StaffHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(session.role === "staff" || session.role === "admin" || session.role === "superadmin")) redirect(getDashboardPath(session.role));

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Panel Staff (Prototipo)</h1>
      <p className="text-sm text-neutral-500 mt-1">Sesión: {session.role}</p>
      <a className="underline mt-4 inline-block" href="/logout">Salir</a>
    </div>
  );
}
