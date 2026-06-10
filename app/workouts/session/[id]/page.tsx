import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Card, CardHeader } from "@/app/_components/Card";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { LiveSession } from "@/app/_components/workout/LiveSession";
import { MaxBumpButton } from "@/app/_components/workout/MaxBumpButton";
import { ResolveFlagButton } from "@/app/_components/workout/FlagControls";
import { db } from "@/lib/db";
import { MILO_OFFLINE_MESSAGE, miloEnabled } from "@/lib/milo";
import { fromPrismaDate } from "@/lib/protocol";
import {
  CALF_LABEL,
  INTENSITY_LABEL,
  LIFT_LABEL,
  OFFDAY_LABEL,
  countWorkingSets,
  lastPerformanceFor,
  nextBig3,
  suggestMaxBump,
  topSetOf,
  type CalfType,
  type Intensity,
  type Lift,
  type OffDayType,
} from "@/lib/workout-engine";
import {
  getProgramConfig,
  getSession,
  loadEngineHistory,
  toEngineSession,
  type SessionRow,
} from "@/lib/workouts";
import type {
  LastPerformance,
  SessionView,
} from "@/app/_components/workout/types";

export const dynamic = "force-dynamic";

function sessionTitle(s: SessionRow): string {
  return s.category === "BIG3"
    ? `${LIFT_LABEL[s.mainLift as Lift]} · ${INTENSITY_LABEL[s.intensity as Intensity]}`
    : OFFDAY_LABEL[s.offDayType as OffDayType];
}

function toView(row: SessionRow): SessionView {
  return {
    id: row.id,
    dateISO: format(fromPrismaDate(row.date), "yyyy-MM-dd"),
    category: row.category,
    mainLift: row.mainLift,
    intensity: row.intensity,
    offDayType: row.offDayType,
    calfType: row.calfType,
    focus: row.focus,
    status: row.status,
    sessionRPE: row.sessionRPE,
    cnsLoad: row.cnsLoad,
    jointLoad: row.jointLoad,
    jointLoadArea: row.jointLoadArea,
    performanceGrade: row.performanceGrade,
    userFeedback: row.userFeedback,
    movements: row.movements.map((m) => ({
      id: m.id,
      block: m.block,
      order: m.order,
      role: m.role,
      name: m.name,
      targetSets: m.targetSets,
      targetReps: m.targetReps,
      targetRPE: m.targetRPE,
      targetLoad: m.targetLoad,
      cue: m.cue,
      duration: m.duration,
      actualSets: m.actualSets,
      actualReps: m.actualReps,
      actualRPE: m.actualRPE,
      actualLoad: m.actualLoad,
      amended: m.amended,
      amendReason: m.amendReason,
      sets: m.sets.map((s) => ({
        id: s.id,
        setIndex: s.setIndex,
        setType: s.setType,
        load: s.load,
        reps: s.reps,
        rpe: s.rpe,
      })),
    })),
  };
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSession(id);
  if (!row) notFound();

  const [cfg, history] = await Promise.all([
    getProgramConfig(),
    loadEngineHistory(),
  ]);
  const engineSession = toEngineSession(row);
  const prior = history.filter((s) => (s as { id?: string }).id !== row.id);

  if (row.status === "COMPLETED") {
    const top = topSetOf(engineSession);
    const suggestion =
      row.category === "BIG3" && row.mainLift !== "ZERCHER" && top
        ? suggestMaxBump(
            row.mainLift as Lift,
            { load: top.load, reps: top.reps },
            cfg
          )
        : null;
    const flags = await db.flag.findMany({
      where: { bornSessionId: row.id },
    });

    return (
      <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
        <header className="mb-4 flex items-center gap-3 sm:mb-6">
          <HeaderMenu />
          <div className="leading-tight">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {sessionTitle(row)}
            </h1>
            <p className="text-xs text-zinc-500">
              Completed · {format(fromPrismaDate(row.date), "EEEE, MMM d")}
            </p>
          </div>
          <Link
            href="/workouts"
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← Today
          </Link>
        </header>

        <div className="flex flex-col gap-3">
          {row.focus && (
            <Card tone="accent">
              <div className="text-xs uppercase tracking-wider text-emerald-400/80">
                Session focus
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                {row.focus}
              </p>
            </Card>
          )}

          {suggestion && (
            <Card tone="warning">
              <div className="text-sm text-amber-200">
                Top set {suggestion.fromSet.load} × {suggestion.fromSet.reps}{" "}
                puts your estimated {LIFT_LABEL[suggestion.lift]} 1RM at{" "}
                <span className="font-semibold">{suggestion.suggested}</span> —
                above the stored {suggestion.current}.
              </div>
              <MaxBumpButton
                lift={suggestion.lift as "DEADLIFT" | "BENCH"}
                suggested={suggestion.suggested}
              />
            </Card>
          )}

          <Card>
            <CardHeader title="Session summary" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Total working sets</dt>
              <dd className="text-right text-zinc-200">
                {row.totalWorkingSets ?? countWorkingSets(engineSession.movements ?? [])}
              </dd>
              {row.category === "BIG3" && top && (
                <>
                  <dt className="text-zinc-500">Top set</dt>
                  <dd className="text-right text-zinc-200">
                    {top.load} × {top.reps}
                    {top.rpe != null ? ` @ RPE ${top.rpe}` : ""}
                  </dd>
                </>
              )}
              <dt className="text-zinc-500">Calf rotation</dt>
              <dd className="text-right text-zinc-200">
                {CALF_LABEL[row.calfType as CalfType]}
              </dd>
              <dt className="text-zinc-500">CNS load</dt>
              <dd className="text-right text-zinc-200">{row.cnsLoad ?? "—"}</dd>
              <dt className="text-zinc-500">Joint load</dt>
              <dd className="text-right text-zinc-200">
                {row.jointLoad ?? "—"}
                {row.jointLoadArea ? ` · ${row.jointLoadArea}` : ""}
              </dd>
              <dt className="text-zinc-500">Grade</dt>
              <dd className="text-right text-zinc-200">
                {row.performanceGrade ?? "—"}
              </dd>
              <dt className="text-zinc-500">Session RPE</dt>
              <dd className="text-right text-zinc-200">
                {row.sessionRPE ?? "—"}
              </dd>
              <dt className="text-zinc-500">Next lift target</dt>
              <dd className="text-right text-emerald-300">
                {row.nextMainLift
                  ? `${LIFT_LABEL[row.nextMainLift as Lift]} · ${INTENSITY_LABEL[row.nextIntensity as Intensity]}`
                  : "—"}
              </dd>
            </dl>
            {row.userFeedback && (
              <p className="mt-3 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-400">
                {row.userFeedback}
              </p>
            )}
          </Card>

          {flags.length > 0 && (
            <Card>
              <CardHeader title="Flags from this session" />
              <ul className="flex flex-col gap-2">
                {flags.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300">
                      {f.issue}
                      {f.bodyArea ? (
                        <span className="text-zinc-500"> · {f.bodyArea}</span>
                      ) : null}
                      <span className="ml-2 text-[11px] uppercase text-zinc-500">
                        {f.type} · {f.status}
                      </span>
                    </span>
                    {f.status === "ACTIVE" && (
                      <ResolveFlagButton flagId={f.id} sessionId={row.id} />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Work log" />
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((block) => {
                const moves = row.movements.filter((m) => m.block === block);
                if (moves.length === 0) return null;
                return (
                  <div key={block}>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Block {block}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {moves.map((m) => (
                        <li key={m.id} className="text-sm">
                          <span className="text-zinc-200">{m.name}</span>{" "}
                          {m.sets.length > 0 ? (
                            <span className="text-zinc-400">
                              —{" "}
                              {m.sets
                                .map(
                                  (s) =>
                                    `${s.load}×${s.reps}${s.rpe != null ? `@${s.rpe}` : ""}`
                                )
                                .join(", ")}
                            </span>
                          ) : m.actualSets != null ? (
                            <span className="text-zinc-400">
                              — {m.actualSets}
                              {m.actualReps ? ` × ${m.actualReps}` : ""}
                              {m.actualLoad ? ` @ ${m.actualLoad}` : ""}
                              {m.actualRPE != null ? ` · RPE ${m.actualRPE}` : ""}
                            </span>
                          ) : (
                            <span className="text-zinc-600">— skipped</span>
                          )}
                          {m.amended && (
                            <span className="ml-1.5 text-[11px] text-amber-400/90">
                              amended{m.amendReason ? `: ${m.amendReason}` : ""}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // ACTIVE session → the live screen.
  const lift = row.mainLift as Lift | null;
  const lastPerf = lift ? lastPerformanceFor(lift, prior) : null;
  const lastPerformance: LastPerformance = lastPerf
    ? {
        dateISO: format(lastPerf.session.date, "yyyy-MM-dd"),
        sets: (
          lastPerf.session.movements
            ?.find((m) => m.role === "MAIN_LIFT")
            ?.sets?.filter((s) => s.setType !== "WARMUP") ?? []
        ).map((s) => ({ load: s.load, reps: s.reps, rpe: s.rpe ?? null })),
      }
    : null;

  const projected = nextBig3([
    { ...engineSession, status: "COMPLETED", completedAt: new Date() },
    ...prior,
  ]);

  const [activeFlags, chatMessages] = await Promise.all([
    db.flag.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    db.chatMessage.findMany({
      where: { sessionId: row.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  return (
    <LiveSession
      session={toView(row)}
      lastPerformance={lastPerformance}
      projectedNext={`${LIFT_LABEL[projected.lift]} · ${INTENSITY_LABEL[projected.intensity]}`}
      flags={activeFlags.map((f) => ({
        id: f.id,
        issue: f.issue,
        bodyArea: f.bodyArea,
        type: f.type,
        severity: f.severity,
        status: f.status,
      }))}
      chatMessages={chatMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))}
      miloEnabled={miloEnabled()}
      miloOfflineNote={MILO_OFFLINE_MESSAGE}
    />
  );
}
