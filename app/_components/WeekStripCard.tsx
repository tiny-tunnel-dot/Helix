import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { Card, CardHeader } from "./Card";

export async function WeekStripCard() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = addDays(weekStart, 6);

  const injections = await db.injection.findMany({
    where: {
      scheduledDate: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const dayInj = injections.filter((inj) =>
      isSameDay(new Date(inj.scheduledDate), d)
    );
    const total = dayInj.length;
    const done = dayInj.filter((i) => i.loggedAt).length;
    return { d, total, done, isToday: isSameDay(d, today) };
  });

  return (
    <Card>
      <CardHeader title="This Week" subtitle={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`} />
      <div className="flex justify-between gap-1.5">
        {days.map(({ d, total, done, isToday }) => {
          const fullPct = total === 0 ? 0 : done / total;
          return (
            <div key={d.toISOString()} className="flex flex-col items-center gap-1.5">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                {format(d, "EEEEE")}
              </div>
              <div
                className={`relative flex h-12 w-7 items-end overflow-hidden rounded-md border ${
                  isToday ? "border-emerald-400/60" : "border-zinc-800"
                } bg-zinc-950/40`}
              >
                <div
                  className="w-full bg-emerald-500/70"
                  style={{ height: `${fullPct * 100}%` }}
                />
              </div>
              <div className={`text-[10px] ${isToday ? "text-emerald-300" : "text-zinc-500"}`}>
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
