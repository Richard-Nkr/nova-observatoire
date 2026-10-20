import { cn } from "@/lib/utils";

/**
 * Wordmark NOVA OBSERVATOIRE.
 * Le logotype fourni est reconstruit en typographie afin de rester net
 * à toutes les tailles (sidebar, exports PowerPoint, favicon textuel).
 */
export function Logo({
  variant = "dark",
  className,
  compact = false,
}: {
  variant?: "dark" | "light";
  className?: string;
  compact?: boolean;
}) {
  const light = variant === "light";
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "block h-[17px] w-[3px]",
            light ? "bg-[#c9916b]" : "bg-accent",
          )}
        />
        <span
          className={cn(
            "font-logo text-[19px] tracking-[0.16em]",
            light ? "text-white" : "text-navy",
          )}
        >
          NOVA
        </span>
      </div>
      {!compact && (
        <span
          className={cn(
            "ml-[11px] mt-1.5 text-[7.5px] font-semibold uppercase tracking-[0.34em]",
            light ? "text-white/55" : "text-muted",
          )}
        >
          Observatoire
        </span>
      )}
    </div>
  );
}