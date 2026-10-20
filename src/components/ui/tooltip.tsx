"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  children,
  content,
  side = "top",
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-[80] max-w-[280px] rounded-[3px] border border-navy-line bg-navy px-2.5 py-2 text-[11px] leading-[1.45] text-white shadow-[0_8px_24px_rgba(15,36,51,0.25)]",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-navy" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
