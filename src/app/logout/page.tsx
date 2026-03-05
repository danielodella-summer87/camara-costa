import { logout } from "@/src/app/actions/auth";

export default function LogoutPage() {
  return (
    <form action={logout} className="min-h-screen flex items-center justify-center p-6">
      <button className="rounded-xl bg-black text-white px-4 py-2 font-medium">
        Confirmar salida
      </button>
    </form>
  );
}
