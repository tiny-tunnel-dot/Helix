import Link from "next/link";
import { TodayCard } from "./_components/TodayCard";
import { CycleProgressCard } from "./_components/CycleProgressCard";
import { AdherenceCard } from "./_components/AdherenceCard";
import { WeekStripCard } from "./_components/WeekStripCard";
import { VialCard } from "./_components/VialCard";
import { WeightCard } from "./_components/WeightCard";
import { SiteRotationCard } from "./_components/SiteRotationCard";
import { WorkoutCard } from "./_components/workout/WorkoutCard";
import { HeaderMenu } from "./_components/HeaderMenu";
import HelixLogo from "./_components/HelixLogo";
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
    <main className="mx-auto max-w-6xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <Link href="/" aria-label="Helix dashboard">
          <HelixLogo size="md" subtitle="Peptide Protocol" />
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <TodayCard date={selectedDate} />
        <CycleProgressCard />
        <AdherenceCard />

        <WeekStripCard />
        <VialCard peptide="BPC_TB" />
        <VialCard peptide="CJC_IPA" />
        <SiteRotationCard />

        <WorkoutCard />
        <WeightCard />
      </div>
    </main>
  );
}
