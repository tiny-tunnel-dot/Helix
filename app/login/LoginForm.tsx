"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="from" value={from} />
      <input
        autoFocus
        type="password"
        name="password"
        placeholder="Password"
        className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
      />
      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
