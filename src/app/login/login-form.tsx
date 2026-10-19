"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";
import { initialLoginState } from "./login-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction] = useActionState(loginAction, initialLoginState);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={nextPath ?? ""} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-800">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={state.errors.email ? "true" : undefined}
          aria-describedby={state.errors.email ? "email-error" : undefined}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        {state.errors.email ? (
          <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
            {state.errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.errors.password ? "true" : undefined}
          aria-describedby={state.errors.password ? "password-error" : undefined}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        {state.errors.password ? (
          <p id="password-error" role="alert" className="mt-1 text-sm text-red-600">
            {state.errors.password}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
