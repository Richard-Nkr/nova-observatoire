"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[3px] border border-line-strong bg-surface shadow-[0_24px_80px_rgba(15,36,51,0.24)]",
          wide ? "max-w-4xl" : "max-w-lg",
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fermer"
          className="absolute right-3 top-3 rounded p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line px-5 py-4 pr-10", className)}>
      <DialogPrimitive.Title className="font-serif text-[22px] font-normal leading-tight tracking-[-0.01em] text-ink">
        {title}
      </DialogPrimitive.Title>
      {description && (
        <DialogPrimitive.Description className="mt-1 text-[12px] text-muted">
          {description}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scroll-thin max-h-[62vh] overflow-y-auto px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-line bg-[#faf8f3] px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
