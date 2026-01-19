import { Suspense } from "react";
import AdminReportesHomeClient from "./AdminReportesHomeClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminReportesHomeClient />
    </Suspense>
  );
}