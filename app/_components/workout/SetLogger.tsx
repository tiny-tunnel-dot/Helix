"use client";

import { useState, useTransition } from "react";
import { deleteSet, logSet } from "@/app/actions/workouts";
import type { LastPerformance, MovementView } from "./types";

const SET_TYPES = [
  { value: "WARMUP", label: "Warm-up" },
  { value: "WORKING", label: "Working" },
  { value: "TOP", label: "Top" },
  { value: "BACKOFF", label: "Back-off" },
] as const;

const RPE_OPTIONS = [
  5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
] as const;

function lowRep(targetReps: string | null): number {
  const m = /^(\d+)/.exec(targetReps ?? "");
  return m ? Number(m[1]) : 5;
}

// Extract a sane numeric prefill from targetLoad strings like
// "60-70% (172-201)" → 185 (plate-rounded midpoint) or "Ramp to ... @ ~140".
function loadPrefill(targetLoad: string | null): number {
  if (!targetLoad) return 135;
  const paren = /\((\d+)-(\d+)\)/.exec(targetLoad);
  if (paren) {
    const mid = (Number(paren[1]) + Number(paren[2])) / 2;
    return Math.round(mid / 5) * 5;
  }
  const approx = /~(\d+)/.exec(targetLoad);
  if (approx) return Number(approx[1]);
  const num = /(\d+)/.exec(targetLoad);
  return num ? Number(num[1]) : 135;
}

// Inline structured logger for the main lift — granular per-set rows into
// SetLog. Pre-fills with the engine target and last session's number for the
// same set index; one tap logs when you hit target.
export function SetLogger({
  movement,
  lastPerformance,
}: {
  movement: MovementView;
  lastPerformance: LastPerformance;
}) {
  const working = movement.sets.filter((s) => s.setType !== "WARMUP");
  const nextWorkingIndex = working.length;
  const last = lastPerformance?.sets?.[nextWorkingIndex] ?? null;
  const lastAny = lastPerformance?.sets?.at(-1) ?? null;
  // Prefill from working sets only — a warm-up shouldn't drag the next
  // working set's suggestion down to warm-up weight.
  const prevWorking = working.at(-1) ?? null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[var(--color-card)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            {movement.name}
            {movement.amended && (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                amended
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            Target: {movement.targetSets} × {movement.targetReps}
            {movement.targetRPE != null ? ` · ≤RPE ${movement.targetRPE}` : ""}
          </div>
          <div className="text-xs text-zinc-500">{movement.targetLoad}</div>
          {movement.amended && movement.amendReason && (
            <div className="mt-0.5 text-[11px] text-amber-400/80">
              {movement.amendReason}
            </div>
          )}
        </div>
      </div>

      {lastPerformance && lastPerformance.sets.length > 0 && (
        <div className="mt-2 rounded-lg bg-zinc-900/70 px-2.5 py-1.5 text-[11px] text-zinc-500">
          Last time ({lastPerformance.dateISO}):{" "}
          {lastPerformance.sets
            .map((s) => `${s.load}×${s.reps}${s.rpe != null ? `@${s.rpe}` : ""}`)
            .join(", ")}
        </div>
      )}

      {movement.sets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {movement.sets.map((s) => (
            <LoggedSetRow key={s.id} set={s} />
          ))}
        </ul>
      )}

      <PendingSet
        key={movement.sets.length}
        movementId={movement.id}
        setNumber={movement.sets.length + 1}
        defaultLoad={prevWorking?.load ?? last?.load ?? lastAny?.load ?? loadPrefill(movement.targetLoad)}
        defaultReps={last?.reps ?? prevWorking?.reps ?? lowRep(movement.targetReps)}
      />
    </div>
  );
}

function LoggedSetRow({
  set,
}: {
  set: MovementView["sets"][number];
}) {
  const [pending, start] = useTransition();
  const typeLabel = SET_TYPES.find((t) => t.value === set.setType)?.label ?? set.setType;
  return (
    <li className="flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-1.5 text-sm">
      <span className="text-zinc-200">
        <span className="text-zinc-500">Set {set.setIndex + 1} · </span>
        {set.load} × {set.reps}
        {set.rpe != null && <span className="text-zinc-400"> @ RPE {set.rpe}</span>}
        <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">
          {typeLabel}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Delete set ${set.setIndex + 1}`}
        disabled={pending}
        onClick={() => start(() => deleteSet(set.id))}
        className="text-zinc-600 hover:text-red-400 disabled:opacity-40"
      >
        ✕
      </button>
    </li>
  );
}

function PendingSet({
  movementId,
  setNumber,
  defaultLoad,
  defaultReps,
}: {
  movementId: string;
  setNumber: number;
  defaultLoad: number;
  defaultReps: number;
}) {
  const [load, setLoad] = useState(defaultLoad);
  const [reps, setReps] = useState(defaultReps);
  const [rpe, setRpe] = useState<number | null>(null);
  const [setType, setSetType] = useState<string>("WORKING");
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-400">
        Set {setNumber}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Stepper
          label="lbs"
          value={load}
          step={5}
          min={0}
          onChange={setLoad}
          wide
        />
        <Stepper label="reps" value={reps} step={1} min={1} onChange={setReps} />
        <select
          aria-label="RPE"
          value={rpe ?? ""}
          onChange={(e) => setRpe(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100"
        >
          <option value="">RPE —</option>
          {RPE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              RPE {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Set type"
          value={setType}
          onChange={(e) => setSetType(e.target.value)}
          className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100"
        >
          {SET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(() =>
            logSet({
              movementId,
              setType: setType as "WARMUP" | "WORKING" | "TOP" | "BACKOFF",
              load,
              reps,
              rpe,
            })
          )
        }
        className="mt-2.5 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log set ✓"}
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  step,
  min,
  onChange,
  wide,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
  wide?: boolean;
}) {
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <button
        type="button"
        aria-label={`decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
        className="h-full px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        −
      </button>
      <div className="flex items-baseline gap-1 px-1">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${wide ? "w-14" : "w-9"} bg-transparent text-center text-sm font-semibold text-zinc-50 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <button
        type="button"
        aria-label={`increase ${label}`}
        onClick={() => onChange(value + step)}
        className="h-full px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        +
      </button>
    </div>
  );
}
