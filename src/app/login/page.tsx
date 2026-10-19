import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/rbac";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next } = await props.searchParams;
  const user = await getSessionUser();

  if (user) {
    redirect(isStaffRole(user.role.code) ? "/admin" : "/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Customers and pharmacy staff sign in with the same form. Staff accounts
          land in the administration area.
        </p>
        <LoginForm nextPath={next} />
      </div>
    </main>
  );
}
