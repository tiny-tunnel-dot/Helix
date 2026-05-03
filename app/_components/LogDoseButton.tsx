"use client";

import { useEffect, useRef, useState } from "react";
import { logInjection } from "@/app/actions/injections";
import { ALLOWED_SITES, type Peptide, type Site } from "@/lib/protocol";

const PART_LABEL: Record<string, string> = {
  stomach: "Stomach",
  shoulder: "Shoulder",
};

function groupSitesByPart(sites: Site[]) {
  const groups: Record<string, { L?: Site; R?: Site }> = {};
  for (const site of sites) {
    const [part, side] = site.split("_") as [string, "L" | "R"];
    groups[part] ??= {};
    groups[part][side] = site;
  }
  return groups;
}

export function LogDoseButton({
  id,
  peptide,
  suggestedSite,
}: {
  id: string;
  peptide: Peptide;
  suggestedSite: Site;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = groupSitesByPart(ALLOWED_SITES[peptide]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Log dose"
        aria-expanded={open}
        className="h-11 w-11 shrink-0 rounded-full border-2 border-zinc-700 bg-transparent transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 active:bg-emerald-500/20"
      />
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Pick site
          </div>
          <div className="flex flex-col gap-3 p-3">
            {Object.entries(groups).map(([part, { L, R }]) => (
              <div key={part}>
                <div className="mb-1.5 text-xs font-medium text-zinc-300">
                  {PART_LABEL[part] ?? part}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["L", "R"] as const).map((side) => {
                    const site = side === "L" ? L : R;
                    if (!site) return <div key={side} />;
                    const isSuggested = site === suggestedSite;
                    return (
                      <form key={side} action={logInjection}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="site" value={site} />
                        <button
                          type="submit"
                          aria-label={`${PART_LABEL[part]} ${side}`}
                          className={`flex h-14 w-full items-center justify-center rounded-xl border-2 text-2xl font-semibold transition-colors active:scale-95 ${
                            isSuggested
                              ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              : "border-zinc-700 bg-zinc-950/40 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
                          }`}
                        >
                          {side}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
