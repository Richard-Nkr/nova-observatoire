"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={150} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
