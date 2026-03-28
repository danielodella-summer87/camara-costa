import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolveAdminLandingPath } from "@/lib/admin/resolveAdminLanding";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const landing = await resolveAdminLandingPath();
  if (landing !== "/admin") {
    redirect(landing);
  }
  return (
    <Suspense fallback={null}>
      <AdminClient />
    </Suspense>
  );
}
