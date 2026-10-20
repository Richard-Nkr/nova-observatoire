"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BarChart3,
  Building2,
  Check,
  Database,
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
      { href: "/base", label: "Base de données", icon: Database },
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

  const nav = () => (
    <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-5 pt-2">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-2 px-2.5 font-logo text-[7.5px] uppercase tracking-[0.16em] text-faint">
            {group.label}
          </p>
          <ul className="space-y-[3px]">
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
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-[8px] text-[12px] transition-colors",
                        active
                          ? "bg-[#edf2f8] font-semibold text-ink"
                          : "text-ink-soft hover:bg-paper hover:text-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center",
                          active ? "text-accent" : "text-muted group-hover:text-ink",
                        )}
                      >
                        <Icon className="size-[15px]" strokeWidth={1.8} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {"badge" in item && item.badge === "basket" && basketCount > 0 && (
                        <span className="rounded-full bg-accent px-1.5 py-[1px] text-[9px] font-semibold tabular text-white">
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
    <div className="border-t border-line px-3 py-3">
      <div className="mb-2.5 rounded-xl border border-line bg-paper px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="font-logo text-[7.5px] uppercase tracking-[0.12em] text-accent">
            Base compilée
          </span>
          <span className="size-1.5 rounded-full bg-accent" />
        </div>
        <p className="mt-1 text-[10px] leading-tight text-muted">
          {fmtInt(state.hotels.length)} hôtels · {state.hotels.length ? new Set(state.hotels.map((h) => h.region)).size : 0} régions
        </p>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-paper"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">
              {currentUser?.initiales ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-medium text-ink">
                {currentUser?.nom}
              </span>
              <span className="block text-[9.5px] text-muted">{currentUser?.role}</span>
            </span>
            {currentUser?.accesConfidentiel && (
              <ShieldCheck className="size-3.5 text-accent" aria-label="Accès confidentiel" />
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="right"
            align="end"
            sideOffset={8}
            className="z-[90] w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_50px_rgba(15,31,58,0.16)]"
          >
            <DropdownMenu.Label className="px-2 py-1.5 font-logo text-[7px] uppercase tracking-[0.14em] text-faint">
              Changer d’utilisateur
            </DropdownMenu.Label>
            {state.users
              .filter((user) => user.actif)
              .map((user) => (
                <DropdownMenu.Item
                  key={user.id}
                  onSelect={() => setCurrentUser(user.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] text-ink-soft outline-none hover:bg-paper"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-paper text-[9px] font-semibold text-ink">
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
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted outline-none hover:bg-paper"
            >
              <LogOut className="size-3.5" />
              Réinitialiser la base
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pb-5 pt-6">
          <Link href="/" aria-label="Nova Observatoire — accueil">
            <Logo />
          </Link>
          <p className="mt-4 flex items-center gap-1.5 text-[8.5px] font-medium uppercase tracking-[0.12em] text-faint">
            <span className="size-1.5 rounded-full bg-accent" />
            Veille & stratégie hôtelière
          </p>
        </div>
        {nav()}
        {footer}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Link href="/" aria-label="Nova Observatoire — accueil">
            <Logo compact />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-2 text-ink-soft hover:bg-paper"
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
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">{children}</div>
          )}
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[95] flex lg:hidden">
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="slide-in-right relative flex h-full w-[280px] flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {nav()}
            {footer}
          </aside>
        </div>
      )}
    </div>
  );
}
