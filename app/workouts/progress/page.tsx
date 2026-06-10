import Link from "next/link";
import { differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { Card, CardHeader } from "@/app/_components/Card";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { WeightChart } from "@/app/_components/WeightChart";
import { AuditPanel } from "@/app/_components/workout/AuditPanel";
import { MaxBumpButton } from "@/app/_components/workout/MaxBumpButton";
import {
  E1RMChart,
  VolumeChart,
  type E1RMPoint,
  type VolumePoint,
} from "@/app/_components/workout/ProgressCharts";
import { db } from "@/lib/db";
import { miloEnabled } from "@/lib/milo";
import { fromPrismaDate, todayLocal } from "@/lib/protocol";
import {
  countWorkingSets,
  epley1RM,
  LIFT_LABEL,
  suggestMaxBump,
  topSetOf,
  type Lift,
} from "@/lib/workout-engine";
import {
  getProgramConfig,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

export const dynamic = "force-dynamic";

const LIFTS: Lift[] = ["DEADLIFT", "BENCH", "ZERCHER"];

export default async function WorkoutProgressPage() {
  const [cfg, rows, weights] = await Promise.all([
    getProgramConfig(),
    loadHistory(200),
    db.weightEntry.findMany({ orderBy: { date: "asc" }, take: 90 }),
  ]);
  const completed = rows
    .filter((r) => r.status === "COMPLETED")
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const today = todayLocal();

  // --- e1RM trend: one point per Big-3 session, keyed per lift
  const e1rmData: E1RMPoint[] = [];
  for (const r of completed) {
    if (r.category !== "BIG3" || !r.mainLift) continue;
    const top = topSetOf(toEngineSession(r));
    if (!top) continue;
    e1rmData.push({
      date: format(fromPrismaDate(r.date), "MMM d"),
      [r.mainLift as Lift]: Math.round(epley1RM(top.load, top.reps)),
    });
  }

  // --- PRs: best e1RM per lift (and the set that earned it)
  const prs = LIFTS.map((lift) => {
    let best: { e1rm: number; load: number; reps: number; date: Date } | null =
      null;
    for (const r of completed) {
      if (r.category !== "BIG3" || r.mainLift !== lift) continue;
      const top = topSetOf(toEngineSession(r));
      if (!top) continue;
      const e1rm = Math.round(epley1RM(top.load, top.reps));
      if (!best || e1rm > best.e1rm) {
        best = { e1rm, load: top.load, reps: top.reps, date: fromPrismaDate(r.date) };
      }
    }
    return { lift, best };
  });

  // --- weekly volume (computed working sets per ISO-ish week, Monday start)
  const weekMap = new Map<string, { week: string; sets: number; order: number }>();
  for (const r of completed) {
    const ws = startOfWeek(fromPrismaDate(r.date), { weekStartsOn: 1 });
    const key = format(ws, "yyyy-MM-dd");
    const sets =
      r.totalWorkingSets ?? countWorkingSets(toEngineSession(r).movements ?? []);
    const entry = weekMap.get(key) ?? {
      week: format(ws, "MMM d"),
      sets: 0,
      order: ws.getTime(),
    };
    entry.sets += sets;
    weekMap.set(key, entry);
  }
  const volumeData: VolumePoint[] = [...weekMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ week, sets }) => ({ week, sets }));

  // --- adherence: this week + 4-week average
  const sessionsLast7 = completed.filter(
    (r) => differenceInCalendarDays(today, fromPrismaDate(r.date)) < 7
  ).length;
  const sessionsLast28 = completed.filter(
    (r) => differenceInCalendarDays(today, fromPrismaDate(r.date)) < 28
  ).length;
  const big3Count = completed.filter((r) => r.category === "BIG3").length;
  const offCount = completed.length - big3Count;

  // --- standing max suggestions (suggest-only; confirm with a tap)
  const suggestions = prs
    .map(({ lift, best }) =>
      best && lift !== "ZERCHER"
        ? suggestMaxBump(lift, { load: best.load, reps: best.reps }, cfg)
        : null
    )
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const weightData = weights.map((w) => ({
    date: format(fromPrismaDate(w.date), "MMM d"),
    weight: w.weight,
  }));

  return (
    <main className="mx-auto max-w-3xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <div className="leading-tight">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Progress
          </h1>
          <p className="text-xs text-zinc-500">
            {completed.length} sessions · {big3Count} Big-3 · {offCount} off-days
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
        {suggestions.map((s) => (
          <Card key={s.lift} tone="warning">
            <div className="text-sm text-amber-200">
              Best {LIFT_LABEL[s.lift]} top set ({s.fromSet.load} ×{" "}
              {s.fromSet.reps}) puts your e1RM at{" "}
              <span className="font-semibold">{s.suggested}</span> — above the
              stored {s.current}.
            </div>
            <MaxBumpButton
              lift={s.lift as "DEADLIFT" | "BENCH"}
              suggested={s.suggested}
            />
          </Card>
        ))}

        <Card>
          <CardHeader
            title="Estimated 1RM"
            subtitle="Epley off each session's top set"
          />
          <div className="h-64">
            <E1RMChart data={e1rmData} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {prs.map(({ lift, best }) => (
            <Card key={lift}>
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                {LIFT_LABEL[lift]} best
              </div>
              {best ? (
                <>
                  <div className="mt-1 text-2xl font-semibold text-zinc-50">
                    {best.e1rm}
                    <span className="ml-1 text-sm font-normal text-zinc-500">
                      e1RM
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {best.load} × {best.reps} · {format(best.date, "MMM d")}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-zinc-600">no sessions yet</div>
              )}
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader
            title="Weekly volume"
            subtitle="Total working sets (engine-counted)"
          />
          <div className="h-44">
            <VolumeChart data={volumeData} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader title="Adherence" />
            <div className="flex items-baseline gap-6">
              <div>
                <div className="text-3xl font-semibold text-zinc-50">
                  {sessionsLast7}
                </div>
                <div className="text-xs text-zinc-500">sessions, last 7 days</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-zinc-50">
                  {(sessionsLast28 / 4).toFixed(1)}
                </div>
                <div className="text-xs text-zinc-500">per week, 4-week avg</div>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Body weight"
              subtitle="Logged on the dashboard"
              right={
                <span className="text-xs text-zinc-500">
                  {weights.length > 0
                    ? `${weights[weights.length - 1].weight} lb`
                    : ""}
                </span>
              }
            />
            <div className="h-24">
              <WeightChart data={weightData} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Program maxes"
            subtitle="Drive every %1RM prescription"
            right={
              <Link
                href="/settings"
                className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600"
              >
                Edit
              </Link>
            }
          />
          <div className="flex gap-8 text-sm">
            <div>
              <span className="text-zinc-500">Deadlift</span>{" "}
              <span className="font-semibold text-zinc-100">
                {cfg.deadlift1RM}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Bench</span>{" "}
              <span className="font-semibold text-zinc-100">{cfg.bench1RM}</span>
            </div>
            <div>
              <span className="text-zinc-500">Zercher cap</span>{" "}
              <span className="font-semibold text-zinc-100">
                {Math.round((cfg.deadlift1RM * cfg.zercherCapPct) / 100 / 5) * 5}
              </span>
            </div>
          </div>
        </Card>

        <AuditPanel enabled={miloEnabled()} />
      </div>
    </main>
  );
}
