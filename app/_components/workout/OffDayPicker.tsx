"use client";

import { useState } from "react";
import { startOffDaySession } from "@/app/actions/workouts";

const OPTIONS = [
  {
    type: "RESET",
    title: "Reset + Restore",
    blurb:
      "Mobility circuit, low-load core, optional Zone 2. For heavy joints, stiffness, or a deload.",
  },
  {
    type: "TUNE",
    title: "Tune the Engine",
    blurb: "Primes the NEXT lift's pattern. Recovered, lifting heavy soon.",
  },
  {
    type: "BUILD",
    title: "Build Without Burnout",
    blurb:
      "Grip, core, and calf capacity at RPE ≤ 6, carries, easy finisher. Feeling good, no CNS hit.",
  },
] as const;

// Phase-2 picker: the three engine archetypes, chosen by feel. When Milo is
// live these blurbs are replaced by LLM-tailored pitches built off the last
// 2-3 summaries.
export function OffDayPicker({ nextLiftLabel }: { nextLiftLabel: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-medium text-zinc-100">
            Take an Off-Day
          </div>
          <div className="text-xs text-zinc-500">
            Three options, picked by feel
          </div>
        </div>
        <span className="text-zinc-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-2">
          {OPTIONS.map((o) => (
            <form key={o.type} action={startOffDaySession}>
              <input type="hidden" name="type" value={o.type} />
              <button
                type="submit"
                className="w-full rounded-xl border border-zinc-800 px-4 py-3 text-left hover:border-emerald-500/50 hover:bg-zinc-900"
              >
                <div className="text-sm font-semibold text-zinc-100">
                  {o.title}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  {o.type === "TUNE"
                    ? `Primes ${nextLiftLabel} — pattern activation, light positional work, optional short cardio.`
                    : o.blurb}
                </div>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
