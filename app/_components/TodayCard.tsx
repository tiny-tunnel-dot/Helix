import { startOfDay, endOfDay, format } from "date-fns";
import { db } from "@/lib/db";
import {
  CYCLE_START,
  PEPTIDE_LABEL,
  SLOT_LABEL,
  SITE_LABEL,
  dayOfCycle,
  nextSiteFor,
  type Peptide,
  type Site,
  type Slot,
} from "@/lib/protocol";
import { Card, CardHeader } from "./Card";
import { logInjection, unlogInjection } from "@/app/actions/injections";

export async function TodayCard() {
  const today = startOfDay(new Date());
  const tomorrow = endOfDay(today);

  const todays = await db.injection.findMany({
    where: {
      scheduledDate: { gte: today, lte: tomorrow },
    },
    orderBy: [{ slot: "asc" }],
  });

  const recent = await db.injection.findMany({
    where: { loggedAt: { not: null } },
    orderBy: { loggedAt: "desc" },
    take: 12,
  });

  function suggestSite(p: Peptide): Site {
    const sitesForPeptide = recent
      .filter((i) => i.peptide === p)
      .map((i) => i.site as Site | null);
    return nextSiteFor(p, sitesForPeptide);
  }

  const day = dayOfCycle(today);

  return (
    <Card span={2}>
      <CardHeader
        title="Today"
        subtitle={`${format(today, "EEE, MMM d")} · Day ${day} of 57`}
        right={
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
            {todays.filter((i) => i.loggedAt).length}/{todays.length} logged
          </span>
        }
      />
      {todays.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No scheduled doses today. Cycle starts {format(CYCLE_START, "MMM d")}.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {todays.map((inj) => {
            const logged = !!inj.loggedAt;
            const peptide = inj.peptide as Peptide;
            const slot = inj.slot as Slot;
            const suggestedSite = suggestSite(peptide);
            return (
              <li
                key={inj.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                  logged
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-950/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100">
                    {SLOT_LABEL[slot]}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {PEPTIDE_LABEL[peptide]} · {inj.doseUnits} units ·{" "}
                    {logged ? (
                      <span className="text-emerald-400">
                        logged {format(inj.loggedAt!, "h:mma")} ·{" "}
                        {SITE_LABEL[inj.site as Site]}
                      </span>
                    ) : (
                      <>suggested: {SITE_LABEL[suggestedSite]}</>
                    )}
                  </div>
                </div>
                {logged ? (
                  <form action={unlogInjection}>
                    <input type="hidden" name="id" value={inj.id} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      undo
                    </button>
                  </form>
                ) : (
                  <form action={logInjection} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={inj.id} />
                    <input type="hidden" name="site" value={suggestedSite} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
                    >
                      Log
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
