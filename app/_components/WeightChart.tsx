"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function WeightChart({
  data,
}: {
  data: { date: string; weight: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
        Log a weight to see the trend
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <YAxis hide domain={[min, max]} />
        <Tooltip
          contentStyle={{
            background: "#0a0a0b",
            border: "1px solid #232328",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
          itemStyle={{ color: "#34d399" }}
          formatter={(v) => [`${v as number} lb`, ""]}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#34d399"
          strokeWidth={2}
          dot={{ r: 2, fill: "#34d399" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
