import { startOfDay, format } from "date-fns";
import { CYCLE_DAYS, CYCLE_END, dayOfCycle } from "@/lib/protocol";
import { Card, CardHeader } from "./Card";

export function CycleProgressCard() {
  const today = startOfDay(new Date());
  const day = dayOfCycle(today);
  const pct = Math.min(1, day / CYCLE_DAYS);

  // arc from -120deg to 120deg (240deg sweep)
  const r = 56;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const sweep = 240;
  const angle = startAngle + sweep * pct;

  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [sx, sy] = polar(startAngle);
  const [ex, ey] = polar(angle);
  const [tx, ty] = polar(startAngle + sweep);
  const largeArc = sweep * pct > 180 ? 1 : 0;

  return (
    <Card>
      <CardHeader title="Cycle Progress" subtitle={`Ends ${format(CYCLE_END, "MMM d")}`} />
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 140 110" className="w-full max-w-[200px]">
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${tx} ${ty}`}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
            stroke="#34d399"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          <text
            x="70"
            y="68"
            textAnchor="middle"
            fontSize="22"
            fontWeight="600"
            fill="#fafafa"
          >
            {day}
          </text>
          <text x="70" y="88" textAnchor="middle" fontSize="10" fill="#71717a">
            of {CYCLE_DAYS}
          </text>
        </svg>
        <div className="mt-1 text-xs text-zinc-500">
          {CYCLE_DAYS - day} days remaining
        </div>
      </div>
    </Card>
  );
}
