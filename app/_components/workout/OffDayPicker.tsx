"use client";

import { useState } from "react";
import { startOffDaySession } from "@/app/actions/workouts";

type Option = {
  type: "RESET" | "TUNE" | "BUILD";
  title: string;
  description: string;
};

const FALLBACK_OPTIONS: Option[] = [
  {
    type: "RESET",
    title: "Reset + Restore",
    description:
      "Mobility circuit, low-load core, optional Zone 2. For heavy joints, stiffness, or a deload.",
  },
  {
    type: "TUNE",
    title: "Tune the Engine",
    description:
      "Primes the next lift's pattern — activation, light positional work, optional short cardio.",
  },
  {
    type: "BUILD",
    title: "Build Without Burnout",
    description:
      "Grip, core, and calf capacity at RPE ≤ 6, carries, easy finisher. Feeling good, no CNS hit.",
  },
];

// "LLM proposes 3, Tony picks by feel" (spec §3.6). Options are fetched when
// the picker opens: Milo-tailored pitches when the key is configured, engine
// archetypes otherwise. The chosen pitch rides along as the session focus.
export function OffDayPicker({ nextLiftLabel }: { nextLiftLabel: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [source, setSource] = useState<"milo" | "default">("default");
  const [loading, setLoading] = useState(false);

  async function expand() {
    setOpen((o) => !o);
    if (options !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/milo/offday-options");
      const data = await res.json();
      setOptions(data.options ?? FALLBACK_OPTIONS);
      setSource(data.source ?? "default");
    } catch {
      setOptions(FALLBACK_OPTIONS);
      setSource("default");
    } finally {
      setLoading(false);
    }
  }

  const shown = options ?? FALLBACK_OPTIONS;

  return (
    <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-4 sm:p-5">
      <button
        type="button"
        onClick={expand}
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
          {loading && (
            <div className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-500">
              Milo is reading your last few sessions…
            </div>
          )}
          {!loading &&
            shown.map((o) => (
              <form key={o.type} action={startOffDaySession}>
                <input type="hidden" name="type" value={o.type} />
                {source === "milo" && (
                  <input type="hidden" name="description" value={o.description} />
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl border border-zinc-800 px-4 py-3 text-left hover:border-emerald-500/50 hover:bg-zinc-900"
                >
                  <div className="text-sm font-semibold text-zinc-100">
                    {o.title}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                    {o.type === "TUNE" && source === "default"
                      ? `Primes ${nextLiftLabel} — pattern activation, light positional work, optional short cardio.`
                      : o.description}
                  </div>
                </button>
              </form>
            ))}
          {!loading && source === "milo" && (
            <p className="text-right text-[10px] uppercase tracking-wider text-zinc-600">
              tailored by Milo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
