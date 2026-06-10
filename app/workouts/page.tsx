import Link from "next/link";
import { format } from "date-fns";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { Card, CardHeader } from "@/app/_components/Card";
import { OffDayPicker } from "@/app/_components/workout/OffDayPicker";
import { ResolveFlagButton } from "@/app/_components/workout/FlagControls";
import { startBig3Session } from "@/app/actions/workouts";
import { fromPrismaDate, todayLocal } from "@/lib/protocol";
import {
  detectDeload,
  INTENSITY_LABEL,
  LIFT_LABEL,
  CALF_LABEL,
  mainLiftPrescription,
  nextBig3,
  nextCalf,
  offDayNudge,
  OFFDAY_LABEL,
  type Intensity,
  type Lift,
  type OffDayType,
} from "@/lib/workout-engine";
import {
  getActiveFlags,
  getActiveSession,
  getProgramConfig,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

export const dynamic = "force-dynamic";

export default async function WorkoutsTodayPage() {
  const [cfg, rows, active, flags] = await Promise.all([
    getProgramConfig(),
    loadHistory(),
    getActiveSession(),
    getActiveFlags(),
  ]);
  const history = rows.map(toEngineSession);
  const today = todayLocal();

  const target = nextBig3(history);
  const calf = nextCalf(history);
  const prescription = mainLiftPrescription(
    target.lift,
    target.intensity,
    cfg,
    history
  );
  const nudge = offDayNudge(history, today);
  const deload = detectDeload(history);
  const recent = rows.filter((r) => r.status === "COMPLETED").slice(0, 5);

  return (
    <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <Link href="/workouts" className="leading-tight">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Workouts
          </h1>
          <p className="text-xs text-zinc-500">Milo · Big-3 strength</p>
        </Link>
        <nav className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
          <Link href="/workouts/history" className="hover:text-zinc-200">
            History
          </Link>
          <Link href="/workouts/progress" className="hover:text-zinc-200">
            Progress
          </Link>
        </nav>
      </header>

      <div className="flex flex-col gap-3">
        {active && (
          <Card tone="accent">
            <CardHeader
              title="Session in progress"
              subtitle={
                active.category === "BIG3"
                  ? `${LIFT_LABEL[active.mainLift as Lift]} · ${INTENSITY_LABEL[active.intensity as Intensity]}`
                  : OFFDAY_LABEL[active.offDayType as OffDayType]
              }
            />
            <Link
              href={`/workouts/session/${active.id}`}
              className="inline-block rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Resume session →
            </Link>
          </Card>
        )}

        {deload.deload && (
          <Card tone="warning">
            <div className="text-sm font-medium text-amber-300">
              Deload recommended
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {deload.reasons.join(" ")}
            </p>
          </Card>
        )}

        {!deload.deload && nudge && (
          <Card tone="warning">
            <p className="text-sm text-amber-200/90">{nudge}</p>
          </Card>
        )}

        {!active && (
          <>
            <Card>
              <CardHeader
                title="Next up"
                subtitle={`Calves: ${CALF_LABEL[calf]} · maxes DL ${cfg.deadlift1RM} / Bench ${cfg.bench1RM}`}
              />
              <div className="text-3xl font-semibold tracking-tight text-zinc-50">
                {LIFT_LABEL[target.lift]}
                <span className="text-zinc-500"> · </span>
                {INTENSITY_LABEL[target.intensity]}
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {prescription.sets} × {prescription.repsRange} ·{" "}
                {prescription.loadText}
              </p>
              {prescription.notes.map((n) => (
                <p key={n} className="mt-1 text-xs text-zinc-500">
                  {n}
                </p>
              ))}
              <form action={startBig3Session} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Start Big-3 · {LIFT_LABEL[target.lift]}{" "}
                  {INTENSITY_LABEL[target.intensity]}
                </button>
              </form>
            </Card>

            <OffDayPicker nextLiftLabel={LIFT_LABEL[target.lift]} />
          </>
        )}

        {flags.length > 0 && (
          <Card>
            <CardHeader
              title="Active flags"
              subtitle="Carried forward until resolved"
            />
            <ul className="flex flex-col gap-2">
              {flags.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-200">
                      {f.issue}
                      {f.bodyArea ? (
                        <span className="text-zinc-500"> · {f.bodyArea}</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                      {f.type}
                      {f.severity ? ` · ${f.severity}` : ""} · since{" "}
                      {format(fromPrismaDate(f.bornSession.date), "MMM d")}
                    </div>
                  </div>
                  <ResolveFlagButton flagId={f.id} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {recent.length > 0 && (
          <Card>
            <CardHeader title="Recent sessions" />
            <ul className="flex flex-col gap-1.5">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/workouts/session/${s.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-900"
                  >
                    <span className="text-zinc-300">
                      {s.category === "BIG3"
                        ? `${LIFT_LABEL[s.mainLift as Lift]} · ${INTENSITY_LABEL[s.intensity as Intensity]}`
                        : OFFDAY_LABEL[s.offDayType as OffDayType]}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {format(fromPrismaDate(s.date), "EEE MMM d")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
