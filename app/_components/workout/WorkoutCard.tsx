import Link from "next/link";
import { format } from "date-fns";
import { Card, CardHeader } from "@/app/_components/Card";
import { fromPrismaDate, todayLocal } from "@/lib/protocol";
import {
  INTENSITY_LABEL,
  LIFT_LABEL,
  nextBig3,
  OFFDAY_LABEL,
  offDayNudge,
  type Intensity,
  type Lift,
  type OffDayType,
} from "@/lib/workout-engine";
import {
  getActiveSession,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

// Dashboard card for the workout module — next pull from the rolling queue,
// or the session in progress. Lives in the home card grid.
export async function WorkoutCard() {
  const [rows, active] = await Promise.all([loadHistory(), getActiveSession()]);
  const history = rows.map(toEngineSession);
  const next = nextBig3(history);
  const nudge = offDayNudge(history, todayLocal());
  const lastCompleted = rows.find((r) => r.status === "COMPLETED");

  const icon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
    </svg>
  );

  return (
    <Link href="/workouts" className="block">
      <Card className="h-full transition-colors hover:border-zinc-700">
        <CardHeader
          icon={icon}
          title="Workouts"
          subtitle="Milo · Big-3 strength"
          right={
            active ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                in progress
              </span>
            ) : undefined
          }
        />
        {active ? (
          <div className="text-2xl font-semibold tracking-tight text-zinc-50">
            {active.category === "BIG3"
              ? `${LIFT_LABEL[active.mainLift as Lift]} · ${INTENSITY_LABEL[active.intensity as Intensity]}`
              : OFFDAY_LABEL[active.offDayType as OffDayType]}
          </div>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Next up
            </div>
            <div className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-50">
              {LIFT_LABEL[next.lift]} · {INTENSITY_LABEL[next.intensity]}
            </div>
          </>
        )}
        <div className="mt-2 text-xs text-zinc-500">
          {nudge
            ? nudge
            : lastCompleted
              ? `Last: ${
                  lastCompleted.category === "BIG3"
                    ? LIFT_LABEL[lastCompleted.mainLift as Lift]
                    : OFFDAY_LABEL[lastCompleted.offDayType as OffDayType]
                } · ${format(fromPrismaDate(lastCompleted.date), "EEE MMM d")}`
              : "Pull your first session"}
        </div>
      </Card>
    </Link>
  );
}
