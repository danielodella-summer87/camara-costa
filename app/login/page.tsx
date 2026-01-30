import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded-xl p-6">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded mt-3" />
        <div className="mt-6 space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
