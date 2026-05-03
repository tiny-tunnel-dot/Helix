"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { createVial } from "@/app/actions/vials";

type PeptideValue = "BPC_TB" | "CJC_IPA";

const PEPTIDES: { value: PeptideValue; label: string; days: number }[] = [
  { value: "BPC_TB", label: "BPC/TB", days: 20 },
  { value: "CJC_IPA", label: "CJC/Ipa", days: 28 },
];

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function VialForm({
  nextNumber,
}: {
  nextNumber: Record<PeptideValue, number>;
}) {
  const [peptide, setPeptide] = useState<PeptideValue>("BPC_TB");
  const [vialNumber, setVialNumber] = useState(String(nextNumber[peptide]));
  const [startDate, setStartDate] = useState(todayIso());

  // Re-suggest the next vial number when peptide changes or after a successful
  // submit refreshes the server-provided nextNumber map.
  useEffect(() => {
    setVialNumber(String(nextNumber[peptide]));
  }, [peptide, nextNumber]);

  const days = PEPTIDES.find((p) => p.value === peptide)!.days;
  const computedEnd = format(
    addDays(parseISO(startDate), days - 1),
    "yyyy-MM-dd"
  );

  const [endDate, setEndDate] = useState(computedEnd);
  useEffect(() => {
    setEndDate(computedEnd);
  }, [computedEnd]);

  return (
    <form
      action={createVial}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Peptide
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PEPTIDES.map((p) => (
            <label
              key={p.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                peptide === p.value
                  ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-700 bg-zinc-950/40 text-zinc-200 hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="peptideType"
                value={p.value}
                checked={peptide === p.value}
                onChange={() => setPeptide(p.value)}
                className="sr-only"
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="vialNumber"
          className="text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          Vial number
        </label>
        <input
          id="vialNumber"
          type="number"
          name="vialNumber"
          min={1}
          step={1}
          value={vialNumber}
          onChange={(e) => setVialNumber(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="startDate"
          className="text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          Start date
        </label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="endDate"
          className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          <span>End date</span>
          <span className="text-[10px] normal-case tracking-normal text-zinc-600">
            Suggested: {days} days
          </span>
        </label>
        <input
          id="endDate"
          type="date"
          name="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
        />
      </div>

      <button
        type="submit"
        className="mt-1 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400 active:bg-emerald-600"
      >
        Save vial
      </button>
    </form>
  );
}
