import Link from "next/link";
import { TodayCard } from "./_components/TodayCard";
import { CycleProgressCard } from "./_components/CycleProgressCard";
import { AdherenceCard } from "./_components/AdherenceCard";
import { WeekStripCard } from "./_components/WeekStripCard";
import { VialCard } from "./_components/VialCard";
import { WeightCard } from "./_components/WeightCard";
import { SiteRotationCard } from "./_components/SiteRotationCard";
import { HeaderMenu } from "./_components/HeaderMenu";
import { parseDateParam } from "@/lib/protocol";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = parseDateParam(params.date);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <HeaderMenu />
        <Link href="/" className="leading-tight">
          <h1 className="text-xl font-semibold tracking-tight">Helix</h1>
          <p className="text-xs text-zinc-500">Peptide protocol tracker</p>
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TodayCard date={selectedDate} />
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
