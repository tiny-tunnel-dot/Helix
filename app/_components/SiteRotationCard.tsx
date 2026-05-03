import { format } from "date-fns";
import { db } from "@/lib/db";
import {
  ALLOWED_SITES,
  PEPTIDE_LABEL,
  SITE_LABEL,
  asAppLocal,
  nextSiteFor,
  type Peptide,
  type Site,
} from "@/lib/protocol";
import { Card, CardHeader } from "./Card";

export async function SiteRotationCard() {
  const recent = await db.injection.findMany({
    where: { loggedAt: { not: null }, site: { not: null } },
    orderBy: { loggedAt: "desc" },
    take: 16,
  });

  function lastN(p: Peptide, n: number) {
    return recent
      .filter((i) => i.peptide === p)
      .slice(0, n)
      .map((i) => ({ site: i.site as Site, when: i.loggedAt! }));
  }

  function suggestion(p: Peptide): Site {
    const sites = recent
      .filter((i) => i.peptide === p)
      .map((i) => i.site as Site | null);
    return nextSiteFor(p, sites);
  }

  const peptides: Peptide[] = ["CJC_IPA", "BPC_TB"];

  return (
    <Card>
      <CardHeader title="Site Rotation" subtitle="Last sites used" />
      <div className="flex flex-col gap-3">
        {peptides.map((p) => {
          const last = lastN(p, 3);
          const next = suggestion(p);
          return (
            <div key={p} className="rounded-xl bg-zinc-950/40 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  {PEPTIDE_LABEL[p]}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  Next: {SITE_LABEL[next]}
                </span>
              </div>
              {last.length === 0 ? (
                <div className="text-xs text-zinc-600">No sites logged yet</div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {last.map((l, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between text-xs text-zinc-500"
                    >
                      <span>{SITE_LABEL[l.site]}</span>
                      <span>{format(asAppLocal(l.when), "MMM d")}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1.5 text-[10px] text-zinc-600">
                Allowed: {ALLOWED_SITES[p].map((s) => SITE_LABEL[s]).join(", ")}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
