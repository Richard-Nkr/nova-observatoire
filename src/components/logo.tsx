import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Wordmark officiel NOVA OBSERVATOIRE.
 * Les fichiers sont des détourages du logotype fourni, déclinés en navy
 * (fonds clairs) et en blanc (fonds sombres). Le mode compact ne conserve
 * que le bloc NOVA pour la barre supérieure mobile.
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
  const src = compact
    ? light
      ? "/brand/nova-wordmark-light.png"
      : "/brand/nova-wordmark.png"
    : light
      ? "/brand/nova-logo-light.png"
      : "/brand/nova-logo.png";

  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <Image
        src={src}
        alt="NOVA Observatoire"
        width={500}
        height={compact ? 63 : 100}
        priority
        unoptimized
        className={cn(
          "block w-auto",
          compact ? "h-[18px]" : "h-auto w-[178px]",
        )}
      />
    </div>
  );
}
