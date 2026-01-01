export function Topbar() {
    return (
      <header className="flex h-14 items-center justify-between border-b bg-white px-6">
        <div className="text-sm text-zinc-600">
          Bienvenido, Administrador
        </div>
  
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">🔔</span>
          <span className="text-sm font-medium">Admin</span>
        </div>
      </header>
    );
  }