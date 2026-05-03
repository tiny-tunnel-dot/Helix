import Link from "next/link";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { fromPrismaDate, PEPTIDE_LABEL, type Peptide } from "@/lib/protocol";
import { deleteVial } from "@/app/actions/vials";
import { VialForm } from "./VialForm";

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
          {vials.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
              No vials mixed yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {vials.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100">
                      {PEPTIDE_LABEL[v.peptideType as Peptide]} · Vial{" "}
                      {v.vialNumber}
                      {v.active && (
                        <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {format(fromPrismaDate(v.rangeStart), "MMM d")} →{" "}
                      {format(fromPrismaDate(v.rangeEnd), "MMM d")}
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
