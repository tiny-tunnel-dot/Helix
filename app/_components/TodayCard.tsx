import Link from "next/link";
import { addDays, format, isSameDay } from "date-fns";
import { db } from "@/lib/db";
import {
  CYCLE_DAYS,
  CYCLE_START,
  PEPTIDE_LABEL,
  SITE_LABEL,
  asAppLocal,
  dayOfCycle,
  formatDateParam,
  nextSiteFor,
  todayLocal,
  type Peptide,
  type Site,
  type Slot,
} from "@/lib/protocol";
import { Card } from "./Card";
import { LogDoseButton } from "./LogDoseButton";
import { unlogInjection } from "@/app/actions/injections";

const SLOT_SHORT: Record<Slot, string> = {
  AM_CJC: "Morning",
  MIDDAY_BPC: "Midday",
  PM_CJC: "Bedtime",
};

export async function TodayCard({ date }: { date: Date }) {
  const today = todayLocal();
  const isToday = isSameDay(date, today);

  const doses = await db.injection.findMany({
    where: { scheduledDate: date },
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

  const day = dayOfCycle(date);
  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);
  const hasPrev = prevDate >= CYCLE_START;
  const hasNext = !isToday;

  const prevHref = hasPrev ? `/?date=${formatDateParam(prevDate)}` : "#";
  const nextHref = hasNext
    ? isSameDay(nextDate, today)
      ? "/"
      : `/?date=${formatDateParam(nextDate)}`
    : "#";

  return (
    <Card span={2}>
      <div className="mb-5 flex items-center justify-center gap-3">
        <NavArrow href={prevHref} disabled={!hasPrev} dir="prev" />
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-zinc-50">
            {isToday ? "Today" : format(date, "EEEE")}
          </span>
          <span className="text-sm text-zinc-500">
            · {format(date, "MMM d")}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
            Day {day}/{CYCLE_DAYS}
          </span>
        </div>
        <NavArrow href={nextHref} disabled={!hasNext} dir="next" />
      </div>

      {doses.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No scheduled doses on this day. Cycle starts{" "}
          {format(CYCLE_START, "MMM d")}.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {doses.map((inj) => {
            const logged = !!inj.loggedAt;
            const peptide = inj.peptide as Peptide;
            const slot = inj.slot as Slot;
            const suggestedSite = suggestSite(peptide);
            const displaySite = (logged ? inj.site : suggestedSite) as Site;
            return (
              <li
                key={inj.id}
                className="flex min-h-[72px] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-3"
              >
                <SlotIcon slot={slot} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-5 text-zinc-100">
                    {SLOT_SHORT[slot]}{" "}
                    <span className="font-normal text-zinc-500">
                      · {inj.doseUnits}u {PEPTIDE_LABEL[peptide]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 leading-4 text-[11px] text-zinc-500">
                    <SiteChip site={displaySite} />
                    <span className="truncate">
                      {logged
                        ? `Logged ${format(asAppLocal(inj.loggedAt!), "h:mma")}`
                        : "suggested"}
                    </span>
                  </div>
                </div>
                {logged ? (
                  <UnlogButton id={inj.id} />
                ) : (
                  <LogDoseButton
                    id={inj.id}
                    peptide={peptide}
                    suggestedSite={suggestedSite}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SlotIcon({ slot }: { slot: Slot }) {
  const cls =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300";
  const sw = "1.8";
  if (slot === "AM_CJC") {
    return (
      <div className={cls}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="15" r="4" />
          <path d="M12 5v2M4.5 11l1.5 1.5M19.5 11L18 12.5M3 18h18" />
        </svg>
      </div>
    );
  }
  if (slot === "MIDDAY_BPC") {
    return (
      <div className={cls}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
        </svg>
      </div>
    );
  }
  // PM_CJC → moon
  return (
    <div className={cls}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
      </svg>
    </div>
  );
}

function SiteChip({ site }: { site: Site }) {
  return (
    <span className="shrink-0 rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium leading-4 text-zinc-400">
      {SITE_LABEL[site]}
    </span>
  );
}

function UnlogButton({ id }: { id: string }) {
  return (
    <form action={unlogInjection}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="Mark not logged"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-500/20 text-emerald-300 transition-colors hover:bg-emerald-500/30"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5 12 10 17 19 7" />
        </svg>
      </button>
    </form>
  );
}

function NavArrow({
  href,
  disabled,
  dir,
}: {
  href: string;
  disabled: boolean;
  dir: "prev" | "next";
}) {
  const cls =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-800 active:bg-zinc-800";
  const label = dir === "prev" ? "Previous day" : "Next day";
  const arrow = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir === "prev" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${cls} cursor-not-allowed text-zinc-700`}
      >
        {arrow}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${cls} text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100`}
    >
      {arrow}
    </Link>
  );
}
