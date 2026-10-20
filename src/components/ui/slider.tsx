"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(values) => onChange(values[0])}
      aria-label={ariaLabel}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-[#e0dbd1]">
        <SliderPrimitive.Range className="absolute h-full bg-navy" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3 rounded-full border border-navy bg-surface shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30" />
    </SliderPrimitive.Root>
  );
}
