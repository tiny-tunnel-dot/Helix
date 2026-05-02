import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { PEPTIDE_LABEL, type Peptide } from "@/lib/protocol";
import { Card, CardHeader } from "./Card";
import { markVialMixed } from "@/app/actions/vials";

export async function VialCard({ peptide }: { peptide: Peptide }) {
  const today = startOfDay(new Date());

  const vials = await db.vial.findMany({
    where: { peptideType: peptide },
    orderBy: { vialNumber: "asc" },
  });

  const active = vials.find((v) => v.active) ?? vials[0];
  const next = vials.find((v) => v.vialNumber === active.vialNumber + 1);

  const totalDays =
    differenceInCalendarDays(active.rangeEnd, active.rangeStart) + 1;
  const usedDays = Math.max(
    0,
    Math.min(totalDays, differenceInCalendarDays(today, active.rangeStart) + 1)
  );
  const usedPct = Math.min(1, usedDays / totalDays);
  const daysLeft = Math.max(0, totalDays - usedDays);

  const mixDate = next ? new Date(next.rangeStart) : null;
  const daysToMix = mixDate ? differenceInCalendarDays(mixDate, today) : null;
  const mixSoon = daysToMix !== null && daysToMix >= 0 && daysToMix <= 2;

  return (
    <Card tone={mixSoon ? "warning" : "default"}>
      <CardHeader
        title={`${PEPTIDE_LABEL[peptide]} Vial ${active.vialNumber}`}
        subtitle={`${format(active.rangeStart, "MMM d")} → ${format(active.rangeEnd, "MMM d")}`}
        right={
          <span className="text-xs text-zinc-400">{daysLeft}d left</span>
        }
      />

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full ${
            mixSoon ? "bg-amber-400" : "bg-emerald-500"
          }`}
          style={{ width: `${Math.round(usedPct * 100)}%` }}
        />
      </div>

      {next ? (
        <div className="flex items-center justify-between">
          <div className="text-xs">
            {mixSoon ? (
              <span className="text-amber-300">
                ⚠ Mix vial {next.vialNumber} in {daysToMix}d ({format(mixDate!, "EEE MMM d")})
              </span>
            ) : (
              <span className="text-zinc-500">
                Next: vial {next.vialNumber} on {format(mixDate!, "MMM d")}
              </span>
            )}
          </div>
          {mixSoon && (
            <form action={markVialMixed}>
              <input type="hidden" name="id" value={next.id} />
              <button
                type="submit"
                className="rounded-md bg-amber-400 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-amber-300"
              >
                Mark mixed
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="text-xs text-zinc-500">Last vial of cycle</div>
      )}
    </Card>
  );
}
