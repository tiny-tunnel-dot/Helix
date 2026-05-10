"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CYCLE_START, PEPTIDE_LABEL, type Peptide } from "@/lib/protocol";
import { deleteVial } from "@/app/actions/vials";
import { setCjcDaysOff } from "@/app/actions/cjcRules";

export type VialRow = {
  id: string;
  peptideType: Peptide;
  vialNumber: number;
  rangeStart: string; // ISO yyyy-mm-dd
  rangeEnd: string;
  active: boolean;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayNames(days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(" & ");
}

export function VialList({
  vials,
  currentDaysOff,
  effectiveSince,
  today,
}: {
  vials: VialRow[];
  currentDaysOff: number[];
  effectiveSince: string | null;
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (vials.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        No vials mixed yet.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {vials.map((v) => {
        const isCjc = v.peptideType === "CJC_IPA";
        const open = openId === v.id;
        const start = new Date(v.rangeStart + "T00:00:00");
        const end = new Date(v.rangeEnd + "T00:00:00");

        return (
          <li
            key={v.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40"
          >
            <div className="flex items-center justify-between gap-2 p-3">
              <button
                type="button"
                onClick={() =>
                  isCjc ? setOpenId(open ? null : v.id) : undefined
                }
                disabled={!isCjc}
                className={`min-w-0 flex-1 text-left ${
                  isCjc ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <span>
                    {PEPTIDE_LABEL[v.peptideType]} · Vial {v.vialNumber}
                  </span>
                  {v.active && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      active
                    </span>
                  )}
                  {isCjc && (
                    <span className="ml-auto text-[10px] text-zinc-500">
                      {open ? "▴ hide" : "▾ days off"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {format(start, "MMM d")} → {format(end, "MMM d")}
                </div>
              </button>
              <form action={deleteVial}>
                <input type="hidden" name="id" value={v.id} />
                <button
                  type="submit"
                  className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-300"
                >
                  Delete
                </button>
              </form>
            </div>

            {isCjc && open && (
              <DaysOffEditor
                rangeStart={start}
                rangeEnd={end}
                currentDaysOff={currentDaysOff}
                effectiveSince={effectiveSince}
                today={today}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DaysOffEditor({
  rangeStart,
  rangeEnd,
  currentDaysOff,
  effectiveSince,
  today,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  currentDaysOff: number[];
  effectiveSince: string | null;
  today: string;
}) {
  const [selected, setSelected] = useState<number[]>(currentDaysOff);

  function toggle(day: number) {
    setSelected((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 2) return [prev[1], day];
      return [...prev, day];
    });
  }

  const isOff = (day: number) => selected.includes(day);
  const valid = selected.length === 2;
  const unchanged =
    valid &&
    selected.slice().sort().join(",") ===
      currentDaysOff.slice().sort().join(",");

  // Build a 4-week preview anchored on the later of the vial's range start
  // and "today", so the user is previewing the segment the rule will affect.
  const previewWeeks = useMemo(() => {
    const todayDate = new Date(today + "T00:00:00");
    let anchor = rangeStart < CYCLE_START ? CYCLE_START : rangeStart;
    if (todayDate > anchor) anchor = todayDate;
    const sunday = addDays(anchor, -anchor.getDay());
    const weeks: { date: Date; off: boolean }[][] = [];
    for (let w = 0; w < 4; w++) {
      const row: { date: Date; off: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(sunday, w * 7 + d);
        row.push({ date, off: isOff(date.getDay()) });
      }
      weeks.push(row);
    }
    return weeks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rangeStart.getTime(), today]);

  const previewLabel = `${format(previewWeeks[0][0].date, "MMM d")} – ${format(
    previewWeeks[3][6].date,
    "MMM d"
  )}`;

  const todayPretty = format(new Date(today + "T00:00:00"), "MMM d");
  const sinceLabel = effectiveSince
    ? format(new Date(effectiveSince + "T00:00:00"), "MMM d")
    : "cycle start";

  return (
    <div className="border-t border-zinc-800 px-3 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs text-zinc-400">
          Pick the two days each week to skip CJC/Ipa.
        </p>
        <span className="text-[10px] text-zinc-500">
          current: {dayNames(currentDaysOff)} since {sinceLabel}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, day) => {
          const off = isOff(day);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(day)}
              className={`rounded-md py-1.5 text-xs font-medium transition ${
                off
                  ? "bg-amber-400/90 text-zinc-950"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Preview from {todayPretty}
          </span>
          <span className="text-[10px] text-zinc-500">{previewLabel}</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] text-zinc-500"
            >
              {d[0]}
            </div>
          ))}
          {previewWeeks.flat().map(({ date, off }, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded text-[10px] ${
                off
                  ? "bg-amber-400/20 text-amber-200"
                  : "bg-emerald-500/15 text-emerald-200"
              }`}
              title={format(date, "EEE MMM d")}
            >
              {date.getDate()}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
            on
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-400/70" />
            off
          </span>
          <span className="ml-auto">
            vial {format(rangeStart, "MMM d")} → {format(rangeEnd, "MMM d")}
          </span>
        </div>
      </div>

      <form action={setCjcDaysOff} className="flex items-center gap-2">
        <input
          type="hidden"
          name="daysOff"
          value={selected.slice().sort((a, b) => a - b).join(",")}
        />
        <button
          type="submit"
          disabled={!valid || unchanged}
          className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-zinc-950 enabled:hover:bg-amber-300 disabled:opacity-50"
        >
          Save · effective {todayPretty}
        </button>
        <button
          type="button"
          onClick={() => setSelected(currentDaysOff)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Reset
        </button>
        {unchanged && (
          <span className="text-[10px] text-zinc-500">no change</span>
        )}
      </form>
    </div>
  );
}
