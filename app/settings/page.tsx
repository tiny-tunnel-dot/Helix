import Link from "next/link";
import { format } from "date-fns";
import { HeaderMenu } from "@/app/_components/HeaderMenu";
import { activeDaysOff, todayLocal, type CjcRule } from "@/lib/protocol";
import { loadCjcRules } from "@/lib/cjcRules";
import { DaysOffSettings } from "./DaysOffSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
      </div>
    </main>
  );
}
