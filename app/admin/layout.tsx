import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAppUserFromRequest } from "@/lib/auth/server";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const crm = await getSession();
  if (crm) {
    return <AdminShell>{children}</AdminShell>;
  }

  const appUser = await getAppUserFromRequest();
  if (!appUser) {
    redirect("/login?next=/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
