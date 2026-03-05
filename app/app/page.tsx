import { getSession, getDashboardPath } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AppEntry() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(getDashboardPath(session.role));
}
