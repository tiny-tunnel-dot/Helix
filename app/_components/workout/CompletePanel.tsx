"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSession } from "@/app/actions/workouts";
import { countWorkingSets, GRADE_VALUES } from "@/lib/workout-engine";
import type { SessionView } from "./types";

const RPE_CHOICES = [
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
];

// End-of-session confirm screen: the engine's computed summary previewed
// read-only, the captured (judgment) fields editable, one save.
export function CompletePanel({
  session,
  projectedNext,
  miloEnabled,
}: {
  session: SessionView;
  projectedNext: string;
  miloEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Initialize from any existing draft (Milo's finalizeSummary tool, or a
  // previous visit to this panel).
  const [cnsLoad, setCnsLoad] = useState(session.cnsLoad ?? "MODERATE");
  const [jointLoad, setJointLoad] = useState(session.jointLoad ?? "LOW");
  const [jointArea, setJointArea] = useState(session.jointLoadArea ?? "");
  const [grade, setGrade] = useState(session.performanceGrade ?? "");
  const [rpe, setRpe] = useState<string>(
    session.sessionRPE != null ? String(session.sessionRPE) : ""
  );
  const [feedback, setFeedback] = useState(session.userFeedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftRequested, setDraftRequested] = useState(false);
  const [pending, start] = useTransition();

  // "Last movement done → Milo drafts the captured fields": when the panel
  // opens with no draft yet, ask Milo once and fill the form in place.
  async function requestDraft() {
    if (!miloEnabled || draftRequested) return;
    setDraftRequested(true);
    setDrafting(true);
    try {
      const res = await fetch("/api/milo/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json().catch(() => null);
      if (data?.draft) {
        setCnsLoad(data.draft.cnsLoad ?? "MODERATE");
        setJointLoad(data.draft.jointLoad ?? "LOW");
        setJointArea(data.draft.jointLoadArea ?? "");
        setGrade(data.draft.performanceGrade ?? "");
        setRpe(data.draft.sessionRPE != null ? String(data.draft.sessionRPE) : "");
        setFeedback(data.draft.feedback ?? "");
      }
    } catch {
      // Manual entry stands.
    } finally {
      setDrafting(false);
    }
  }

  const workingSets = useMemo(
    () => countWorkingSets(session.movements),
    [session.movements]
  );
  const top = useMemo(() => {
    const main = session.movements.find((m) => m.role === "MAIN_LIFT");
    const sets = (main?.sets ?? []).filter((s) => s.setType !== "WARMUP");
    if (sets.length === 0) return null;
    const tops = sets.filter((s) => s.setType === "TOP");
    const pool = tops.length > 0 ? tops : sets;
    return [...pool].sort((a, b) => b.load - a.load || b.reps - a.reps)[0];
  }, [session.movements]);

  const isOffDay = session.category === "OFFDAY";
  const rpeMissing = isOffDay && rpe === "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (session.cnsLoad == null) requestDraft();
        }}
        className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-3.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15"
      >
        Finish session →
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[var(--color-card)] p-4">
      <div className="text-sm font-semibold text-zinc-100">Session summary</div>
      <p className="mt-0.5 text-xs text-zinc-500">
        {drafting
          ? "Milo is drafting the judgment calls…"
          : "Computed by the engine — confirm the judgment calls below."}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-zinc-900/70 p-3 text-sm">
        <dt className="text-zinc-500">Total working sets</dt>
        <dd className="text-right font-medium text-zinc-100">{workingSets}</dd>
        {top && (
          <>
            <dt className="text-zinc-500">Top set</dt>
            <dd className="text-right font-medium text-zinc-100">
              {top.load} × {top.reps}
              {top.rpe != null ? ` @ RPE ${top.rpe}` : ""}
            </dd>
          </>
        )}
        <dt className="text-zinc-500">Calf rotation</dt>
        <dd className="text-right font-medium text-zinc-100">
          {session.calfType === "STANDING" ? "Standing" : "Seated"}
        </dd>
        <dt className="text-zinc-500">Next lift target</dt>
        <dd className="text-right font-medium text-emerald-300">{projectedNext}</dd>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
          CNS load
          <select
            value={cnsLoad}
            onChange={(e) => setCnsLoad(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm normal-case text-zinc-100"
          >
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
            <option value="VERY_HIGH">Very high</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
          Joint load
          <select
            value={jointLoad}
            onChange={(e) => setJointLoad(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm normal-case text-zinc-100"
          >
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        {jointLoad !== "LOW" && (
          <label className="col-span-2 flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            Joint area
            <input
              value={jointArea}
              onChange={(e) => setJointArea(e.target.value)}
              placeholder="e.g. Left knee"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
          Grade
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm normal-case text-zinc-100"
          >
            <option value="">—</option>
            {GRADE_VALUES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
          {isOffDay ? "Off-day RPE (required)" : "Session RPE"}
          <select
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className={`rounded-lg border bg-zinc-900 px-2 py-2 text-sm normal-case text-zinc-100 ${
              rpeMissing ? "border-amber-500/60" : "border-zinc-800"
            }`}
          >
            <option value="">—</option>
            {RPE_CHOICES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
          Feedback & observations
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="How it felt, movement issues, anything Milo should weigh next session…"
            className="resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending || rpeMissing}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                await completeSession({
                  sessionId: session.id,
                  cnsLoad: cnsLoad as "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
                  jointLoad: jointLoad as "LOW" | "MODERATE" | "HIGH",
                  jointLoadArea:
                    jointLoad !== "LOW" && jointArea.trim()
                      ? jointArea.trim()
                      : null,
                  performanceGrade: grade || null,
                  userFeedback: feedback.trim() || null,
                  sessionRPE: rpe === "" ? null : Number(rpe),
                });
                router.refresh();
              } catch {
                setError("Couldn't save the session — try again.");
              }
            })
          }
          className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Confirm & save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-zinc-800 px-4 text-sm text-zinc-400"
        >
          Back
        </button>
      </div>
      {rpeMissing && (
        <p className="mt-2 text-[11px] text-amber-400/90">
          Off-days need an RPE — it drives the next Big-3 plan.
        </p>
      )}
    </div>
  );
}
