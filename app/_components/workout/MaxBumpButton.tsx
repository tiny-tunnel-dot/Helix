"use client";

import { useState, useTransition } from "react";
import { applyMaxSuggestion } from "@/app/actions/workouts";

// The "suggest, confirm with a tap" half of the max-bump decision. The engine
// never overwrites a max on its own.
export function MaxBumpButton({
  lift,
  suggested,
}: {
  lift: "DEADLIFT" | "BENCH";
  suggested: number;
}) {
  const [applied, setApplied] = useState(false);
  const [pending, start] = useTransition();

  if (applied) {
    return (
      <p className="mt-2 text-xs font-medium text-emerald-300">
        ✓ Max updated to {suggested}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await applyMaxSuggestion(lift, suggested);
          setApplied(true);
        })
      }
      className="mt-2.5 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
    >
      {pending ? "Updating…" : `Update ${lift === "DEADLIFT" ? "Deadlift" : "Bench"} 1RM to ${suggested}`}
    </button>
  );
}
