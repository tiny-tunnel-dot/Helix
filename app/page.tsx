import Link from "next/link";
import { TodayCard } from "./_components/TodayCard";
import { CycleProgressCard } from "./_components/CycleProgressCard";
import { AdherenceCard } from "./_components/AdherenceCard";
import { WeekStripCard } from "./_components/WeekStripCard";
import { VialCard } from "./_components/VialCard";
import { WeightCard } from "./_components/WeightCard";
import { SiteRotationCard } from "./_components/SiteRotationCard";
import { logout } from "./actions/auth";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Helix</h1>
          <p className="text-xs text-zinc-500">Peptide protocol tracker</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/calendar"
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
          >
            Calendar
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-400 hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TodayCard />
        <CycleProgressCard />
        <AdherenceCard />

        <WeekStripCard />
        <VialCard peptide="BPC_TB" />
        <VialCard peptide="CJC_IPA" />
        <SiteRotationCard />

        <WeightCard />
      </div>
    </main>
  );
}
