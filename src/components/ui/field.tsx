"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-[30px] w-full rounded-[3px] border border-line-strong bg-surface px-2 text-[12.5px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClass, "tabular", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputClass, "h-auto min-h-16 py-1.5 leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          inputClass,
          "appearance-none pr-7",
          !value && placeholder ? "text-faint" : "",
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "pl-7 pr-7")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-black/5 hover:text-ink"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 text-[12px] text-ink-soft",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex size-[13px] shrink-0 items-center justify-center rounded-[2px] border",
          checked
            ? "border-navy bg-navy text-white"
            : "border-line-strong bg-surface",
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 10" className="size-2.5" fill="none">
            <path
              d="M1.5 5.2 3.8 7.5 8.5 2.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  required,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </span>
        {hint && <span className="text-[10px] text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left text-[12px] text-ink-soft"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-[16px] w-[28px] shrink-0 rounded-full border transition-colors",
          checked ? "border-navy bg-navy" : "border-line-strong bg-[#e9e5dd]",
        )}
      >
        <span
          className={cn(
            "absolute top-[1.5px] size-[11px] rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[14px]" : "left-[2px]",
          )}
        />
      </span>
    </button>
  );
}
