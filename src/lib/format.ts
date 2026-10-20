/**
 * Formats français centralisés : montants, pourcentages, dates et nombres.
 */
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return nf0.format(value);
}

export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return digits === 0 ? nf0.format(value) : digits === 2 ? nf2.format(value) : nf1.format(value);
}

export function fmtEuro(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `${nf1.format(value / 1_000_000_000)} Md€`;
    if (Math.abs(value) >= 1_000_000) return `${nf1.format(value / 1_000_000)} M€`;
    if (Math.abs(value) >= 1_000) return `${nf0.format(value / 1_000)} k€`;
  }
  return eur0.format(value);
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${fmtNum(value, digits)} %`;
}

export function fmtTo(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${fmtNum(value * 100, 1)} %`;
}

export function fmtDelta(value: number | null | undefined, unit: "pct" | "pts" | "eur" | "x" = "pct"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  if (unit === "pts") return `${sign}${fmtNum(value, 1)} pts`;
  if (unit === "eur") return `${sign}${fmtEuro(value)}`;
  if (unit === "x") return `${sign}${fmtNum(value, 2)}×`;
  return `${sign}${fmtNum(value, 1)} %`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fmtInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function fmtCategory(category: string | number): string {
  if (category === "Palace") return "Palace";
  return `${category}★`;
}

export function plural(count: number, singular: string, plural = `${singular}s`): string {
  return `${fmtInt(count)} ${count > 1 ? plural : singular}`;
}
