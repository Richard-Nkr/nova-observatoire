"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const ToastContext = React.createContext<{
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
} | null>(null);

const icons = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    ({
      title,
      description,
      tone = "info",
    }: {
      title: string;
      description?: string;
      tone?: ToastTone;
    }) => {
      counter.current += 1;
      const item = { id: counter.current, title, description, tone };
      setItems((current) => [...current.slice(-2), item]);
      window.setTimeout(() => dismiss(item.id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
      >
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto fade-in flex items-start gap-2.5 rounded-[3px] border bg-navy px-3.5 py-3 text-white shadow-[0_10px_36px_rgba(15,36,51,0.28)]",
                item.tone === "error" && "border-[#7b322b] bg-[#59261f]",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  item.tone === "success" ? "text-[#9ed4b8]" : "text-[#d9c6b4]",
                  item.tone === "error" && "text-[#f0b5ae]",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium leading-snug">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/70">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-white/50 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé dans ToastProvider");
  return context;
}
