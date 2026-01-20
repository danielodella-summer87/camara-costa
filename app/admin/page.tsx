import { Suspense } from "react";
import AdminClient from "./AdminClient";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminClient />
    </Suspense>
  );
}
