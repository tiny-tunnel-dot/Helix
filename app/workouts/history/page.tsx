import Link from "next/link";
import { format } from "date-fns";
import { Card } from "@/app/_components/Card";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { fromPrismaDate } from "@/lib/protocol";
import {
  INTENSITY_LABEL,
  LIFT_LABEL,
  OFFDAY_LABEL,
  type Intensity,
  type Lift,
  type OffDayType,
} from "@/lib/workout-engine";
import { loadHistory } from "@/lib/workouts";

export const dynamic = "force-dynamic";

export default async function WorkoutHistoryPage() {
  const rows = (await loadHistory(120)).filter(
    (r) => r.status === "COMPLETED"
  );

  return (
    <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <div className="leading-tight">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Workout history
          </h1>
          <p className="text-xs text-zinc-500">{rows.length} completed sessions</p>
        </div>
        <Link
          href="/workouts"
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-200"
        >
          ← Today
        </Link>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-400">
            Nothing logged yet. Pull your first session from the Today screen.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/workouts/session/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] px-4 py-3 hover:border-zinc-700"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {s.category === "BIG3"
                      ? `${LIFT_LABEL[s.mainLift as Lift]} · ${INTENSITY_LABEL[s.intensity as Intensity]}`
                      : OFFDAY_LABEL[s.offDayType as OffDayType]}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {s.totalWorkingSets != null
                      ? `${s.totalWorkingSets} working sets`
                      : ""}
                    {s.performanceGrade ? ` · ${s.performanceGrade}` : ""}
                  </div>
                </div>
                <span className="text-xs text-zinc-500">
                  {format(fromPrismaDate(s.date), "EEE MMM d")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
