import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "navy" | "accent" | "green" | "amber" | "grey" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-black/[0.055] text-ink-soft border-transparent",
  navy: "bg-navy text-white border-transparent",
  accent: "bg-accent-soft text-accent-strong border-[#e7d3c2]",
  green: "bg-green-soft text-green border-[#c4ddcf]",
  amber: "bg-amber-soft text-amber border-[#ead7b7]",
  grey: "bg-grey-soft text-grey border-[#dcdcd7]",
  danger: "bg-danger-soft text-danger border-[#ecd0cd]",
  outline: "bg-transparent text-ink-soft border-line-strong",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-[1px] text-[10.5px] font-medium leading-[16px] tracking-[0.02em]",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function CategoryBadge({ categorie }: { categorie: string | number }) {
  const label = categorie === "Palace" ? "Palace" : `${categorie}★`;
  if (categorie === "Palace")
    return <Badge tone="accent" className="font-semibold">Palace</Badge>;
  return <Badge tone="outline">{label}</Badge>;
}
