import { redirect } from "next/navigation";
import { getAppUserFromRequest } from "@/lib/auth/server";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getAppUserFromRequest();

  if (!appUser) {
    redirect("/login?next=/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
