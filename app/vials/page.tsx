import Link from "next/link";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import {
  activeDaysOff,
  fromPrismaDate,
  todayLocal,
  type CjcRule,
  type Peptide,
} from "@/lib/protocol";
import { loadCjcRules } from "@/lib/cjcRules";
import { VialForm } from "./VialForm";
import { VialList, type VialRow } from "./VialList";

export const dynamic = "force-dynamic";

export default async function VialsPage() {
  const allVials = await db.vial.findMany({
    orderBy: [{ peptideType: "asc" }, { vialNumber: "asc" }],
  });
  const vials = allVials.filter((v) => v.mixedAt !== null);

  function nextNum(p: Peptide) {
    const used = vials.filter((v) => v.peptideType === p).map((v) => v.vialNumber);
    return used.length === 0 ? 1 : Math.max(...used) + 1;
  }
  const nextNumber = { BPC_TB: nextNum("BPC_TB"), CJC_IPA: nextNum("CJC_IPA") };

  const rows: VialRow[] = vials.map((v) => ({
    id: v.id,
    peptideType: v.peptideType as Peptide,
    vialNumber: v.vialNumber,
    rangeStart: format(fromPrismaDate(v.rangeStart), "yyyy-MM-dd"),
    rangeEnd: format(fromPrismaDate(v.rangeEnd), "yyyy-MM-dd"),
    active: v.active,
  }));

  const rules: CjcRule[] = await loadCjcRules();
  const today = todayLocal();
  const currentDaysOff = activeDaysOff(today, rules);
  const activeRule = rules
    .filter((r) => r.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
  const effectiveSinceISO = activeRule
    ? format(activeRule.effectiveFrom, "yyyy-MM-dd")
    : null;
  const todayISO = format(today, "yyyy-MM-dd");

  return (
    <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <Link href="/" className="leading-tight">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Vials
          </h1>
          <p className="text-xs text-zinc-500">
            Add a new vial · suggested end date based on protocol
          </p>
        </Link>
      </header>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Add vial
          </h2>
          <VialForm nextNumber={nextNumber} />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Existing vials
          </h2>
          <VialList
            vials={rows}
            currentDaysOff={currentDaysOff}
            effectiveSince={effectiveSinceISO}
            today={todayISO}
          />
        </section>
      </div>
    </main>
  );
}
