import Link from "next/link";
import { format } from "date-fns";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { updateMaxes } from "@/app/actions/workouts";
import { activeDaysOff, todayLocal, type CjcRule } from "@/lib/protocol";
import { getProgramConfig } from "@/lib/workouts";
import { loadCjcRules } from "@/lib/cjcRules";
import { DaysOffSettings } from "./DaysOffSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getProgramConfig();
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
            Settings
          </h1>
          <p className="text-xs text-zinc-500">Protocol configuration</p>
        </Link>
      </header>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            CJC/Ipa days off
          </h2>
          <DaysOffSettings
            currentDaysOff={currentDaysOff}
            effectiveSince={effectiveSinceISO}
            today={todayISO}
          />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Workout maxes
          </h2>
          <form
            action={updateMaxes}
            className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-4 sm:p-5"
          >
            <p className="mb-3 text-xs text-zinc-500">
              Milo&apos;s %1RM prescriptions run off these. The engine
              suggests bumps when a top set beats them; it never edits them
              itself.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
                Deadlift 1RM
                <input
                  type="number"
                  name="deadlift1RM"
                  defaultValue={cfg.deadlift1RM}
                  min={45}
                  max={1000}
                  required
                  className="w-28 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
                Bench 1RM
                <input
                  type="number"
                  name="bench1RM"
                  defaultValue={cfg.bench1RM}
                  min={45}
                  max={1000}
                  required
                  className="w-28 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case text-zinc-100"
                />
              </label>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Save maxes
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-600">
              Zercher has no stored max — it ramps to a top set, capped at{" "}
              {cfg.zercherCapPct}% of the deadlift 1RM.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
