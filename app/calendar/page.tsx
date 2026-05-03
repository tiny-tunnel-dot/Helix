import Link from "next/link";
import { format, isSameDay, addDays } from "date-fns";
import { db } from "@/lib/db";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import {
  CYCLE_DAYS,
  CYCLE_START,
  PEPTIDE_LABEL,
  SITE_LABEL,
  SLOT_LABEL,
  asAppLocal,
  fromPrismaDate,
  todayLocal,
  type Peptide,
  type Site,
  type Slot,
} from "@/lib/protocol";
import { logInjection, unlogInjection } from "@/app/actions/injections";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today = todayLocal();
  const all = await db.injection.findMany({
    orderBy: [{ scheduledDate: "asc" }, { slot: "asc" }],
  });

  const days = Array.from({ length: CYCLE_DAYS }, (_, i) =>
    addDays(CYCLE_START, i)
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <HeaderMenu />
        <Link href="/" className="leading-tight">
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-xs text-zinc-500">
            Full 8-week protocol · edit any day
          </p>
        </Link>
      </header>

      <div className="flex flex-col gap-1.5">
        {days.map((d) => {
          const dayInj = all.filter((i) => isSameDay(fromPrismaDate(i.scheduledDate), d));
          const isToday = isSameDay(d, today);
          const isFuture = d > today;
          if (dayInj.length === 0) return null;
          return (
            <div
              key={d.toISOString()}
              className={`rounded-xl border ${
                isToday
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/40"
              } ${isFuture ? "opacity-60" : ""} p-3`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div
                  className={`text-sm font-medium ${
                    isToday ? "text-emerald-300" : "text-zinc-200"
                  }`}
                >
                  {format(d, "EEE, MMM d")}
                  {isToday && (
                    <span className="ml-2 text-[10px] uppercase">today</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {dayInj.filter((i) => i.loggedAt).length}/{dayInj.length}
                </div>
              </div>
              <ul className="flex flex-col gap-1">
                {dayInj.map((inj) => {
                  const logged = !!inj.loggedAt;
                  return (
                    <li
                      key={inj.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-zinc-950/40 px-2.5 py-1.5"
                    >
                      <div className="min-w-0 text-xs">
                        <span
                          className={`font-medium ${
                            logged ? "text-emerald-300" : "text-zinc-300"
                          }`}
                        >
                          {SLOT_LABEL[inj.slot as Slot]}
                        </span>
                        <span className="text-zinc-500">
                          {" · "}
                          {PEPTIDE_LABEL[inj.peptide as Peptide]} · {inj.doseUnits}u
                          {logged && inj.site && (
                            <> · {SITE_LABEL[inj.site as Site]}</>
                          )}
                          {logged && inj.loggedAt && (
                            <> · {format(asAppLocal(inj.loggedAt), "MMM d h:mma")}</>
                          )}
                        </span>
                      </div>
                      {logged ? (
                        <form action={unlogInjection}>
                          <input type="hidden" name="id" value={inj.id} />
                          <button
                            type="submit"
                            className="rounded px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          >
                            undo
                          </button>
                        </form>
                      ) : isFuture ? null : (
                        <form action={logInjection} className="flex gap-1">
                          <input type="hidden" name="id" value={inj.id} />
                          <input type="hidden" name="site" value="stomach_L" />
                          <button
                            type="submit"
                            className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                          >
                            log
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
