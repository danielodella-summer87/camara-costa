import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex">
      
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Topbar */}
        <div className="h-16 shrink-0 border-b border-white/10">
          <Topbar />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 bg-slate-100 text-slate-900">
          {children}
        </div>

      </div>
    </div>
  );
}