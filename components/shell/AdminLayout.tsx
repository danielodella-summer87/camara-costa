import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <div className="h-16 shrink-0 bg-white border-b border-slate-200">
          <Topbar />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}