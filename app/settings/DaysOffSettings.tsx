"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CYCLE_START } from "@/lib/protocol";
import { setCjcDaysOff } from "@/app/actions/cjcRules";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayNames(days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(" & ");
}

export function DaysOffSettings({
  currentDaysOff,
  effectiveSince,
  today,
}: {
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

  // Build a 4-week preview anchored on the later of the cycle start and
  // "today", so the user previews the segment the rule will actually affect.
  const previewWeeks = useMemo(() => {
    const todayDate = new Date(today + "T00:00:00");
    const anchor = todayDate > CYCLE_START ? todayDate : CYCLE_START;
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
  }, [selected, today]);

  const previewLabel = `${format(previewWeeks[0][0].date, "MMM d")} – ${format(
    previewWeeks[3][6].date,
    "MMM d"
  )}`;

  const todayPretty = format(new Date(today + "T00:00:00"), "MMM d");
  const sinceLabel = effectiveSince
    ? format(new Date(effectiveSince + "T00:00:00"), "MMM d")
    : "cycle start";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
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
            <div key={d} className="text-center text-[10px] text-zinc-500">
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
