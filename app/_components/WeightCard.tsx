import { format } from "date-fns";
import { db } from "@/lib/db";
import { fromPrismaDate } from "@/lib/protocol";
import { Card, CardHeader } from "./Card";
import { WeightChart } from "./WeightChart";
import { WeightInput } from "./WeightInput";

export async function WeightCard() {
  const entries = await db.weightEntry.findMany({
    orderBy: { date: "asc" },
  });

  const today = entries[entries.length - 1];
  const first = entries[0];
  const delta =
    today && first ? (today.weight - first.weight).toFixed(1) : null;

  return (
    <Card span={2}>
      <CardHeader
        title="Bodyweight"
        subtitle="Daily reading"
        right={
          today && (
            <span className="text-xs text-zinc-400">
              {today.weight}lb · {format(fromPrismaDate(today.date), "MMM d")}
            </span>
          )
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-zinc-50">
            {today ? `${today.weight} lb` : "—"}
          </div>
          {delta !== null && (
            <div
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                Number(delta) > 0
                  ? "bg-amber-500/15 text-amber-300"
                  : Number(delta) < 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {Number(delta) >= 0 ? "+" : ""}
              {delta} lb cycle
            </div>
          )}
          <div className="mt-3">
            <WeightInput />
          </div>
        </div>
        <div className="h-20 w-full sm:h-24 sm:flex-1">
          <WeightChart
            data={entries.map((e) => ({
              date: format(fromPrismaDate(e.date), "MMM d"),
              weight: e.weight,
            }))}
          />
        </div>
      </div>
    </Card>
  );
}
