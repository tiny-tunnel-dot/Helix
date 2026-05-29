"use client";

import { format } from "date-fns";
import { PEPTIDE_LABEL, type Peptide } from "@/lib/protocol";
import { deleteVial } from "@/app/actions/vials";

export type VialRow = {
  id: string;
  peptideType: Peptide;
  vialNumber: number;
  rangeStart: string; // ISO yyyy-mm-dd
  rangeEnd: string;
  active: boolean;
};

export function VialList({ vials }: { vials: VialRow[] }) {
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
        const start = new Date(v.rangeStart + "T00:00:00");
        const end = new Date(v.rangeEnd + "T00:00:00");

        return (
          <li
            key={v.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40"
          >
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <span>
                    {PEPTIDE_LABEL[v.peptideType]} · Vial {v.vialNumber}
                  </span>
                  {v.active && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      active
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {format(start, "MMM d")} → {format(end, "MMM d")}
                </div>
              </div>
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
          </li>
        );
      })}
    </ul>
  );
}
