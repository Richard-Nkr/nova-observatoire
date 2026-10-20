import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scroll-thin relative isolate overflow-auto", className)}>
      <table className="w-full border-collapse text-left text-[11.5px]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  sortable,
  active,
  direction,
  onSort,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  sortable?: boolean;
  active?: boolean;
  direction?: "asc" | "desc";
  onSort?: () => void;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-[#f7f9fc] px-2.5 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "inline-flex items-center gap-1 hover:text-ink",
            align === "right" && "flex-row-reverse",
            active && "text-ink",
          )}
        >
          {children}
          {active ? (
            direction === "asc" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : (
            <ChevronsUpDown className="size-3 opacity-35" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  colSpan,
  title,
  onClick,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLTableCellElement>) => void;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      onClick={onClick}
      style={style}
      className={cn(
        "border-b border-line/70 px-2.5 py-2 align-middle text-ink-soft",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
