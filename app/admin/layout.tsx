import AdminShell from "@/components/admin/AdminShell";
import Sidebar from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell sidebar={<Sidebar />} topbar={<Topbar />}>
      {children}
    </AdminShell>
  );
}