import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-line bg-surface shadow-[0_1px_0_rgba(23,32,41,0.03)]",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb}
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[30px] font-normal leading-[1.08] tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
          {children}
        </h2>
        {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
  wrap,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-l border-line px-3 py-2 first:border-l-0",
        accent && "bg-accent-soft/45",
        className,
      )}
    >
      <p
        className={cn(
          "text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted",
          wrap ? "leading-[1.25]" : "truncate",
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 truncate font-serif text-[19px] leading-tight tabular text-ink">
        {value}
      </p>
      {sub && (
        <p className={cn("mt-0.5 text-[10px] text-faint", wrap ? "leading-[1.3]" : "truncate")}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-serif text-[19px] text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "navy",
  className,
}: {
  value: number;
  tone?: "navy" | "green" | "amber" | "accent" | "danger";
  className?: string;
}) {
  const colors = {
    navy: "bg-navy",
    green: "bg-green",
    amber: "bg-amber",
    accent: "bg-accent",
    danger: "bg-danger",
  };
  return (
    <div className={cn("h-[5px] w-full overflow-hidden rounded-full bg-black/[0.07]", className)}>
      <div
        className={cn("h-full rounded-full transition-all", colors[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function DefinitionList({
  items,
  className,
  columns = 2,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-5 gap-y-2.5",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-[12.5px] text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: React.ReactNode; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0 border-b border-line", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "relative -mb-px border-b-2 px-3 py-2 text-[11.5px] font-medium transition-colors",
            value === tab.value
              ? "border-accent text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 rounded-[2px] bg-black/[0.06] px-1 py-[0.5px] text-[9.5px] tabular text-muted">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
