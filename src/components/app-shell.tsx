"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BarChart3,
  Building2,
  Check,
  DatabaseZap,
  GitCompareArrows,
  LayoutGrid,
  LogOut,
  Menu,
  Presentation,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import { Logo } from "./logo";

const navGroups = [
  {
    label: "Explorer",
    items: [
      { href: "/", label: "Carte & recherche", icon: LayoutGrid },
      { href: "/hotels", label: "Fiches hôtels", icon: Building2 },
    ],
  },
  {
    label: "Analyser",
    items: [
      { href: "/comparateur", label: "Comparateur", icon: GitCompareArrows, badge: "basket" },
      { href: "/benchmarks", label: "Benchmarks", icon: Presentation },
      { href: "/marche", label: "Marché & transactions", icon: BarChart3 },
    ],
  },
  {
    label: "Données",
    items: [
      { href: "/import", label: "Import & enrichissement", icon: DatabaseZap },
      { href: "/qualite", label: "Qualité des données", icon: ShieldCheck },
      { href: "/admin", label: "Administration", icon: Settings2 },
    ],
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, currentUser, setCurrentUser, resetDemo } = useStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isMap = pathname === "/";
  const basketCount = state.basket.length;

  const nav = (light = false) => (
    <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-4 pt-5">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-4">
          <p
            className={cn(
              "mb-1.5 px-2 text-[8.5px] font-semibold uppercase tracking-[0.18em]",
              light ? "text-white/55" : "text-white/35",
            )}
          >
            {group.label}
          </p>
          <ul className="space-y-[2px]">
            {group.items
              .filter((item) => item.href !== "/admin" || currentUser.role === "Admin")
              .map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-[2px] px-2 py-[7px] text-[12px] transition-colors",
                        active
                          ? "bg-white/[0.09] text-white"
                          : "text-white/62 hover:bg-white/[0.05] hover:text-white/90",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center",
                          active ? "text-[#d3a07e]" : "text-white/45 group-hover:text-white/70",
                        )}
                      >
                        <Icon className="size-[15px]" strokeWidth={1.7} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {"badge" in item && item.badge === "basket" && basketCount > 0 && (
                        <span className="rounded-[2px] bg-[#c9916b] px-1 py-[1px] text-[9px] font-semibold tabular text-navy">
                          {basketCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/[0.09] px-3 py-3">
      <div className="mb-2.5 rounded-[2px] border border-white/[0.09] bg-white/[0.035] px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#d3a07e]">
            Environnement démo
          </span>
          <span className="size-1.5 rounded-full bg-[#c9916b]" />
        </div>
        <p className="mt-0.5 text-[10px] leading-tight text-white/45">
          {fmtInt(state.hotels.length)} hôtels fictifs · {state.hotels.length ? new Set(state.hotels.map((h) => h.region)).size : 0} régions
        </p>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[2px] px-1 py-1 text-left transition-colors hover:bg-white/[0.05]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-[10px] font-semibold text-white/85">
              {currentUser?.initiales ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-medium text-white/90">
                {currentUser?.nom}
              </span>
              <span className="block text-[9.5px] text-white/40">{currentUser?.role}</span>
            </span>
            {currentUser?.accesConfidentiel && (
              <ShieldCheck className="size-3.5 text-[#d3a07e]" aria-label="Accès confidentiel" />
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="right"
            align="end"
            sideOffset={8}
            className="z-[90] w-60 rounded-[3px] border border-line-strong bg-surface p-1 shadow-[0_12px_40px_rgba(15,36,51,0.22)]"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
              Changer d’utilisateur (démo)
            </DropdownMenu.Label>
            {state.users
              .filter((user) => user.actif)
              .map((user) => (
                <DropdownMenu.Item
                  key={user.id}
                  onSelect={() => setCurrentUser(user.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-[2px] px-2 py-1.5 text-[11.5px] text-ink-soft outline-none hover:bg-black/[0.045]"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-black/[0.06] text-[9px] font-semibold">
                    {user.initiales}
                  </span>
                  <span className="flex-1">
                    <span className="block leading-tight">{user.nom}</span>
                    <span className="block text-[9.5px] text-muted">{user.role}</span>
                  </span>
                  {user.id === currentUser?.id && <Check className="size-3.5 text-accent" />}
                </DropdownMenu.Item>
              ))}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={resetDemo}
              className="flex cursor-pointer items-center gap-2 rounded-[2px] px-2 py-1.5 text-[11px] text-muted outline-none hover:bg-black/[0.045]"
            >
              <LogOut className="size-3.5" />
              Réinitialiser les données démo
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <aside className="hidden h-full w-[228px] shrink-0 flex-col bg-navy lg:flex">
        <div className="border-b border-white/[0.08] px-5 py-5">
          <Link href="/" aria-label="Nova Observatoire — accueil">
            <Logo variant="light" />
          </Link>
        </div>
        {nav()}
        {footer}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Link href="/" aria-label="Nova Observatoire — accueil">
            <Logo compact />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded p-2 text-ink-soft hover:bg-black/5"
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1",
            isMap ? "overflow-hidden" : "scroll-thin overflow-y-auto",
          )}
        >
          {isMap ? (
            <div className="h-full">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-[1580px] px-4 py-5 sm:px-6 xl:px-8">{children}</div>
          )}
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[95] flex lg:hidden">
          <div className="absolute inset-0 bg-navy/45" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[268px] flex-col bg-navy shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <Logo variant="light" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {nav(true)}
            {footer}
          </aside>
        </div>
      )}
    </div>
  );
}
