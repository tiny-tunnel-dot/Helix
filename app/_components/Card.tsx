import { ReactNode } from "react";

type Tone = "default" | "accent" | "warning";

const TONE_BG: Record<Tone, string> = {
  default: "bg-[var(--color-card)] border-[var(--color-card-border)]",
  accent: "bg-emerald-500/10 border-emerald-500/30",
  warning: "bg-amber-500/10 border-amber-500/40",
};

export function Card({
  children,
  className = "",
  span = 1,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  span?: 1 | 2;
  tone?: Tone;
}) {
  const colSpan = span === 2 ? "lg:col-span-2" : "";
  return (
    <div
      className={`rounded-2xl border ${TONE_BG[tone]} p-5 ${colSpan} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-200">
            {icon}
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-zinc-100">{title}</div>
          {subtitle && (
            <div className="text-xs text-zinc-500">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function BigStat({
  value,
  caption,
}: {
  value: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight text-zinc-50">
        {value}
      </div>
      {caption && (
        <div className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
          {caption}
        </div>
      )}
    </div>
  );
}
