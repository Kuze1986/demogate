import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="metric-gradient glass rounded-2xl p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.14em] soft-muted">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {subtitle ? <p className="mt-1 text-xs soft-muted">{subtitle}</p> : null}
    </div>
  );
}
