"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0a0a0b",
    border: "1px solid #232328",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#a1a1aa" },
} as const;

export type E1RMPoint = {
  date: string; // "May 11"
  DEADLIFT?: number;
  BENCH?: number;
  ZERCHER?: number;
};

const LIFT_COLORS: Record<string, string> = {
  DEADLIFT: "#34d399",
  BENCH: "#60a5fa",
  ZERCHER: "#fbbf24",
};

// Per-lift estimated 1RM (Epley off each session's top set), one line per
// lift. Mirrors the WeightChart dark styling.
export function E1RMChart({ data }: { data: E1RMPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
        Complete a Big-3 session to see the trend
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="#1c1c20" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b6b73", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#232328" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={["dataMin - 10", "dataMax + 10"]}
          tick={{ fill: "#6b6b73", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, name) => [
            `${v ?? "—"} lb`,
            name === "DEADLIFT" ? "Deadlift" : name === "BENCH" ? "Bench" : "Zercher",
          ]}
        />
        <Legend
          formatter={(v) =>
            v === "DEADLIFT" ? "Deadlift" : v === "BENCH" ? "Bench" : "Zercher"
          }
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
        />
        {(["DEADLIFT", "BENCH", "ZERCHER"] as const).map((lift) => (
          <Line
            key={lift}
            type="monotone"
            dataKey={lift}
            stroke={LIFT_COLORS[lift]}
            strokeWidth={2}
            dot={{ r: 2.5, fill: LIFT_COLORS[lift] }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export type VolumePoint = { week: string; sets: number };

// Weekly total working sets (the rollup's computed number, summed per week).
export function VolumeChart({ data }: { data: VolumePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
        No completed sessions yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#1c1c20" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fill: "#6b6b73", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#232328" }}
        />
        <YAxis
          tick={{ fill: "#6b6b73", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => [`${v ?? 0} working sets`, ""]}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar
          dataKey="sets"
          fill="#34d399"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
