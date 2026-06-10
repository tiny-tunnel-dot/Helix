"use client";

import { useState, useTransition } from "react";
import { logMovementActuals } from "@/app/actions/workouts";
import type { MovementView } from "./types";

const ROLE_CHIP: Record<string, string> = {
  ACTIVATION: "Activation",
  MOBILITY: "Mobility",
  CALF: "Calves",
  COMPLEMENTARY: "Complementary",
  INTEGRITY: "Integrity",
  CARDIO: "Cardio",
};

function prescriptionLine(m: MovementView): string {
  const parts: string[] = [];
  if (m.targetSets != null && m.targetReps) {
    parts.push(`${m.targetSets} × ${m.targetReps}`);
  } else if (m.duration) {
    parts.push(m.duration);
  }
  if (m.targetRPE != null) parts.push(`RPE ${m.targetRPE}`);
  if (m.targetLoad) parts.push(m.targetLoad);
  return parts.join(" · ");
}

// Coarse logger for accessories/mobility/cardio — "Done as planned" is one
// tap that copies targets into actuals; details are editable when reality
// differed.
export function MovementCard({ movement: m }: { movement: MovementView }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const logged = m.actualSets != null || m.actualReps != null || m.actualLoad != null;

  const doneAsPlanned = () =>
    start(() =>
      logMovementActuals({
        movementId: m.id,
        actualSets: m.targetSets ?? (m.duration ? 1 : null),
        actualReps: m.targetReps ?? m.duration ?? null,
        actualRPE: m.targetRPE ?? null,
        actualLoad: m.targetLoad ?? null,
      })
    );

  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        logged
          ? "border-emerald-500/35 bg-emerald-500/[0.04]"
          : "border-[var(--color-card-border)] bg-[var(--color-card)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-100">
              {m.name}
            </span>
            <span className="shrink-0 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              {ROLE_CHIP[m.role] ?? m.role}
            </span>
            {m.amended && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                amended
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">{prescriptionLine(m)}</div>
          {m.cue && <div className="mt-0.5 text-[11px] italic text-zinc-500">{m.cue}</div>}
          {m.amended && m.amendReason && (
            <div className="mt-0.5 text-[11px] text-amber-400/80">{m.amendReason}</div>
          )}
          {logged && !editing && (
            <div className="mt-1.5 text-xs text-emerald-300">
              ✓ Logged: {m.actualSets ?? "—"}
              {m.actualReps ? ` × ${m.actualReps}` : ""}
              {m.actualLoad ? ` @ ${m.actualLoad}` : ""}
              {m.actualRPE != null ? ` · RPE ${m.actualRPE}` : ""}
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {!logged && (
              <button
                type="button"
                disabled={pending}
                onClick={doneAsPlanned}
                className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {pending ? "…" : "Done ✓"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              {logged ? "Edit" : "Log details"}
            </button>
          </div>
        )}
      </div>

      {editing && <ActualsForm movement={m} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ActualsForm({
  movement: m,
  onClose,
}: {
  movement: MovementView;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(String(m.actualSets ?? m.targetSets ?? ""));
  const [reps, setReps] = useState(m.actualReps ?? m.targetReps ?? m.duration ?? "");
  const [load, setLoad] = useState(m.actualLoad ?? m.targetLoad ?? "");
  const [rpe, setRpe] = useState(String(m.actualRPE ?? m.targetRPE ?? ""));
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
      <div className="grid grid-cols-4 gap-2">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
          Sets
          <input
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            inputMode="numeric"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
          Reps/time
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
          Load
          <input
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
          RPE
          <input
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            inputMode="decimal"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await logMovementActuals({
                movementId: m.id,
                actualSets: sets.trim() === "" ? null : Number(sets),
                actualReps: reps.trim() === "" ? null : reps.trim(),
                actualLoad: load.trim() === "" ? null : load.trim(),
                actualRPE: rpe.trim() === "" ? null : Number(rpe),
              });
              onClose();
            })
          }
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
