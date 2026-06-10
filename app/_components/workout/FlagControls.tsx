"use client";

import { useState, useTransition } from "react";
import { createFlag, resolveFlag } from "@/app/actions/workouts";

export function ResolveFlagButton({
  flagId,
  sessionId,
}: {
  flagId: string;
  sessionId?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => resolveFlag(flagId, sessionId))}
      className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-50"
    >
      {pending ? "…" : "Resolve"}
    </button>
  );
}

const FLAG_TYPES = [
  "PAIN",
  "FATIGUE",
  "TIGHTNESS",
  "REGRESSION",
  "DELOAD",
  "OTHER",
] as const;

export function AddFlagForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [bodyArea, setBodyArea] = useState("");
  const [type, setType] = useState<(typeof FLAG_TYPES)[number]>("PAIN");
  const [severity, setSeverity] = useState<"LOW" | "MED" | "HIGH" | "">("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      >
        + Flag an issue
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-3">
      <input
        value={issue}
        onChange={(e) => setIssue(e.target.value)}
        placeholder="Issue (e.g. knee felt off on the pull)"
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
      />
      <div className="flex gap-2">
        <input
          value={bodyArea}
          onChange={(e) => setBodyArea(e.target.value)}
          placeholder="Body area"
          className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="w-1/4 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
        >
          {FLAG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as typeof severity)}
          className="w-1/4 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
        >
          <option value="">Severity</option>
          <option value="LOW">Low</option>
          <option value="MED">Med</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || issue.trim().length === 0}
          onClick={() =>
            start(async () => {
              await createFlag({
                sessionId,
                issue: issue.trim(),
                bodyArea: bodyArea.trim() || null,
                type,
                severity: severity || null,
              });
              setIssue("");
              setBodyArea("");
              setSeverity("");
              setOpen(false);
            })
          }
          className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save flag"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
