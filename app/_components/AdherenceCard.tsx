import { db } from "@/lib/db";
import { todayLocal } from "@/lib/protocol";
import { Card, CardHeader, BigStat } from "./Card";

export async function AdherenceCard() {
  const today = todayLocal();

  const scheduled = await db.injection.count({
    where: { scheduledDate: { lte: today } },
  });
  const logged = await db.injection.count({
    where: { scheduledDate: { lte: today }, loggedAt: { not: null } },
  });

  const pct = scheduled === 0 ? 0 : Math.round((logged / scheduled) * 100);
  return (
    <Card>
      <CardHeader title="Adherence" subtitle="Logged vs. scheduled" />
      <BigStat
        value={`${pct}%`}
        caption={`${logged} of ${scheduled} doses`}
      />
    </Card>
  );
}
