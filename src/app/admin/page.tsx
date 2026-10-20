"use client";

import * as React from "react";
import {
  Check,
  Download,
  FileClock,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { EXTRACTION_DATE, RELIABILITY_META } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtInt } from "@/lib/format";
import { downloadBlob } from "@/lib/utils";
import { PageHeader, Card, SectionTitle, StatTile, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SearchInput, Select } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { TableShell, Th, Td } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { UserDialog } from "@/components/admin/user-dialog";

const ROLES: Role[] = ["Lecteur", "Contributeur", "Admin"];
const PERIODS = [
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
  { value: "all", label: "Tout l’historique" },
];
const MATRIX = [
  { droit: "Consulter la base et les cartes", lecteur: true, contributeur: true, admin: true },
  { droit: "Exporter Excel / PowerPoint", lecteur: true, contributeur: true, admin: true },
  { droit: "Créer et enrichir des fiches", lecteur: false, contributeur: true, admin: true },
  { droit: "Données clients confidentielles", lecteur: false, contributeur: true, admin: true },
  { droit: "Gérer les utilisateurs et l’audit", lecteur: false, contributeur: false, admin: true },
];

const ACTION_TONE: Record<string, "neutral" | "navy" | "accent" | "green" | "amber" | "danger"> = {
  Export: "navy",
  Création: "green",
  Ajout: "green",
  Suppression: "danger",
  Conflit: "danger",
  Consultation: "amber",
  Import: "accent",
  Modification: "accent",
  "Mise à jour": "accent",
};

function actionTone(action: string) {
  const found = Object.entries(ACTION_TONE).find(([key]) => action.includes(key));
  return found?.[1] ?? "neutral";
}

export default function AdminPage() {
  const { state, currentUser, updateUser, addAudit, resetDemo } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("users");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState("all");
  const [actor, setActor] = React.useState("all");
  const [period, setPeriod] = React.useState("30");

  const isAdmin = currentUser.role === "Admin";
  const canSeeConfidential = currentUser.accesConfidentiel || isAdmin;
  const usersById = new Map(state.users.map((user) => [user.id, user]));
  const activeAdmins = state.users.filter((user) => user.role === "Admin" && user.actif).length;

  const lastActivity = new Map<string, string>();
  for (const entry of state.audit) {
    const previous = lastActivity.get(entry.userId);
    if (!previous || entry.date > previous) lastActivity.set(entry.userId, entry.date);
  }

  const visibleAudit = canSeeConfidential
    ? state.audit
    : state.audit.filter((entry) => !entry.confidential);
  const hiddenConfidential = state.audit.length - visibleAudit.length;
  const actions = Array.from(new Set(visibleAudit.map((entry) => entry.action))).sort();

  const cutoff =
    period === "all"
      ? null
      : new Date(`${EXTRACTION_DATE}T23:59:59Z`).getTime() - Number(period) * 86_400_000;
  const normalizedSearch = search.trim().toLowerCase();

  const filteredAudit = visibleAudit
    .filter((entry) => action === "all" || entry.action === action)
    .filter((entry) => actor === "all" || entry.userId === actor)
    .filter((entry) => cutoff === null || new Date(entry.date).getTime() >= cutoff)
    .filter((entry) => {
      if (!normalizedSearch) return true;
      const user = usersById.get(entry.userId)?.nom ?? "";
      return `${entry.action} ${entry.target} ${entry.details} ${user}`
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const exportsCount = state.audit.filter((entry) => entry.action.includes("Export")).length;
  const confidentialCount = state.audit.filter((entry) => entry.confidential).length;

  const exportAudit = () => {
    if (!isAdmin) return;
    const header = ["Date", "Utilisateur", "Rôle", "Action", "Objet", "Détail", "Confidentiel"];
    const rows = filteredAudit.map((entry) => {
      const user = usersById.get(entry.userId);
      return [
        fmtDateTime(entry.date),
        user?.nom ?? "Système",
        user?.role ?? "—",
        entry.action,
        entry.target,
        entry.details,
        entry.confidential ? "Oui" : "Non",
      ];
    });
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const content =
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
    downloadBlob(
      new Blob([content], { type: "text/csv;charset=utf-8;" }),
      `Nova_Journal_audit_${EXTRACTION_DATE}.csv`,
    );
    addAudit({
      action: "Export du journal d’audit",
      target: `${filteredAudit.length} entrée(s)`,
      details: "Export CSV depuis l’administration",
    });
    toast({
      title: "Journal exporté",
      description: `${filteredAudit.length} entrée(s) · traçabilité de l’export enregistrée`,
    });
  };

  const changeRole = (userId: string, role: Role) => {
    if (role === "Admin") {
      updateUser(userId, { role, accesConfidentiel: true });
    } else {
      updateUser(userId, { role });
    }
    toast({ title: "Rôle mis à jour", description: `${role} · droits appliqués immédiatement` });
  };

  const confirmReset = () => {
    resetDemo();
    setResetOpen(false);
    setTab("users");
    toast({
      title: "Démonstration réinitialisée",
      description: "Hôtels, KPI, imports, tâches et utilisateurs ont été restaurés.",
      tone: "success",
    });
  };

  return (
    <div className="mx-auto max-w-[1580px] px-4 py-5 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow="Gouvernance"
        title="Administration"
        description="Utilisateurs, rôles, accès aux données clients confidentielles et journal d’audit de l’observatoire."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="md" onClick={exportAudit} disabled={!filteredAudit.length}>
                <Download />
                Exporter le journal
              </Button>
            )}
            {isAdmin && (
              <Button variant="accent" size="md" onClick={() => setInviteOpen(true)}>
                <UserPlus />
                Inviter un utilisateur
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-2 border border-line bg-surface sm:grid-cols-4">
        <StatTile
          wrap
          label="Utilisateurs actifs"
          value={`${state.users.filter((user) => user.actif).length} / ${state.users.length}`}
          sub={`${activeAdmins} administrateur(s)`}
        />
        <StatTile
          wrap
          label="Accès confidentiel"
          value={fmtInt(state.users.filter((user) => user.accesConfidentiel).length)}
          sub="Transactions et missions client"
        />
        <StatTile
          wrap
          label="Entrées d’audit"
          value={fmtInt(state.audit.length)}
          sub={`${exportsCount} exports tracés`}
        />
        <StatTile
          wrap
          label="Entrées confidentielles"
          value={fmtInt(confidentialCount)}
          sub={canSeeConfidential ? "Visibles avec votre accès" : `${hiddenConfidential} masquée(s)`}
          accent={!canSeeConfidential && hiddenConfidential > 0}
        />
      </div>

      {!isAdmin && (
        <div className="mt-3 flex items-start gap-2 border border-amber/30 bg-amber-soft/60 px-3 py-2 text-[11.5px] text-amber">
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Votre rôle <strong>{currentUser.role}</strong> donne un accès en lecture seule à
            l’administration. Seuls les administrateurs peuvent modifier les rôles et exporter le
            journal d’audit.
          </p>
        </div>
      )}

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "Utilisateurs & droits", count: state.users.length },
          { value: "audit", label: "Journal d’audit", count: state.audit.length },
        ]}
      />

      {tab === "users" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card padded={false} className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <SectionTitle className="mb-0" hint="Les changements sont appliqués immédiatement dans l’interface.">
                Comptes de l’observatoire
              </SectionTitle>
              <Badge tone="outline">{state.users.length} comptes</Badge>
            </div>
            <TableShell className="max-h-[560px]">
              <thead>
                <tr>
                  <Th>Utilisateur</Th>
                  <Th>Rôle</Th>
                  <Th>Accès confidentiel</Th>
                  <Th>Statut</Th>
                  <Th>Dernière activité</Th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => {
                  const self = user.id === currentUser.id;
                  const lastAdmin = user.role === "Admin" && user.actif && activeAdmins === 1;
                  const locked = !isAdmin || self || lastAdmin;
                  return (
                    <tr key={user.id} className={user.actif ? "" : "bg-black/[0.018] text-muted"}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">
                            {user.initiales}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-ink">
                              {user.nom}
                              {self && <Badge tone="accent">Vous</Badge>}
                            </p>
                            <p className="truncate text-[10.5px] text-muted">{user.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Select
                          aria-label={`Rôle de ${user.nom}`}
                          value={user.role}
                          onChange={(value) => changeRole(user.id, value as Role)}
                          options={ROLES.map((role) => ({ value: role, label: role }))}
                          disabled={locked}
                          className="w-[138px]"
                        />
                      </Td>
                      <Td>
                        {user.role === "Admin" ? (
                          <Badge tone="green" dot>
                            Accès complet
                          </Badge>
                        ) : (
                          <Checkbox
                            checked={user.accesConfidentiel}
                            onChange={(checked) =>
                              updateUser(user.id, { accesConfidentiel: checked })
                            }
                            disabled={!isAdmin}
                            label={
                              <span className={user.accesConfidentiel ? "text-green" : "text-muted"}>
                                {user.accesConfidentiel ? "Autorisé" : "Refusé"}
                              </span>
                            }
                          />
                        )}
                      </Td>
                      <Td>
                        <Checkbox
                          checked={user.actif}
                          onChange={(checked) => updateUser(user.id, { actif: checked })}
                          disabled={locked}
                          label={user.actif ? "Actif" : "Inactif"}
                        />
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {lastActivity.has(user.id) ? fmtDate(lastActivity.get(user.id)!) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[10.5px] text-faint">
              <p>Un administrateur ne peut pas retirer ses propres droits ni désactiver son compte.</p>
              <p>Les droits confidentiels sont contrôlés à l’export et à l’affichage.</p>
            </div>
          </Card>

          <aside className="space-y-4">
            <Card>
              <SectionTitle hint="Droits appliqués aux rôles de l’observatoire.">Matrice des droits</SectionTitle>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-[0.08em] text-muted">
                    <th className="pb-1.5 text-left font-semibold">Action</th>
                    <th className="pb-1.5 text-center font-semibold">Lect.</th>
                    <th className="pb-1.5 text-center font-semibold">Contrib.</th>
                    <th className="pb-1.5 text-center font-semibold">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((row) => (
                    <tr key={row.droit} className="border-t border-line/70">
                      <td className="py-1.5 pr-2 text-ink-soft">{row.droit}</td>
                      {[row.lecteur, row.contributeur, row.admin].map((allowed, index) => (
                        <td key={index} className="py-1.5 text-center">
                          {allowed ? (
                            <Check className="mx-auto size-3.5 text-green" />
                          ) : (
                            <X className="mx-auto size-3.5 text-faint" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 border-t border-line pt-2 text-[10.5px] leading-relaxed text-faint">
                En production, ces règles sont doublées par les politiques RLS PostgreSQL et les
                contrôles serveur.
              </p>
            </Card>

            <Card>
              <SectionTitle hint="Données réservées aux membres autorisés.">Confidentialité</SectionTitle>
              <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-accent-soft text-accent">
                  <ShieldCheck className="size-4" />
                </span>
                <p className="text-[11.5px] leading-relaxed text-ink-soft">
                  Les transactions et missions marquées <strong>confidentiel client</strong> sont
                  masquées dans les exports externes et retirées des vues non autorisées.
                </p>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-line pt-2 text-[10.5px] text-muted">
                <p className="flex items-center justify-between">
                  <span>Utilisateurs autorisés</span>
                  <strong className="tabular text-ink">
                    {state.users.filter((user) => user.accesConfidentiel || user.role === "Admin").length}
                  </strong>
                </p>
                <p className="flex items-center justify-between">
                  <span>Transactions confidentielles</span>
                  <strong className="tabular text-ink">
                    {state.transactions.filter((transaction) => transaction.confidentielClient).length}
                  </strong>
                </p>
              </div>
            </Card>

            <Card>
              <SectionTitle>Fiabilité des données</SectionTitle>
              <div className="space-y-1.5">
                {(["N1", "N2", "N3"] as const).map((level) => (
                  <div key={level} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="inline-flex size-4 items-center justify-center rounded-[2px] text-[8px] font-bold"
                      style={{
                        backgroundColor: RELIABILITY_META[level].bg,
                        color: RELIABILITY_META[level].color,
                      }}
                    >
                      {level}
                    </span>
                    <span className="text-ink-soft">{RELIABILITY_META[level].label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-faint">
                Une valeur N1 ne peut jamais être écrasée par une donnée N2 ou N3.
              </p>
            </Card>
          </aside>
        </div>
      ) : (
        <div className="mt-4">
          <Card className="min-w-0">
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-[200px] flex-1">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Rechercher une action, un objet, un utilisateur…"
                />
              </div>
              <Select
                value={action}
                onChange={setAction}
                options={[
                  { value: "all", label: "Toutes les actions" },
                  ...actions.map((item) => ({ value: item, label: item })),
                ]}
                className="w-[190px]"
              />
              <Select
                value={actor}
                onChange={setActor}
                options={[
                  { value: "all", label: "Tous les utilisateurs" },
                  ...state.users.map((user) => ({ value: user.id, label: user.nom })),
                ]}
                className="w-[175px]"
              />
              <Select value={period} onChange={setPeriod} options={PERIODS} className="w-[170px]" />
              <span className="text-[10.5px] text-muted">
                {filteredAudit.length} entrée(s)
              </span>
            </div>

            {hiddenConfidential > 0 && (
              <p className="mt-2 flex items-center gap-1.5 rounded-[2px] bg-amber-soft/60 px-2 py-1.5 text-[10.5px] text-amber">
                <LockKeyhole className="size-3.5" />
                {hiddenConfidential} entrée(s) confidentielle(s) masquée(s) pour votre profil.
              </p>
            )}

            <TableShell className="mt-3 max-h-[540px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Utilisateur</Th>
                  <Th>Action</Th>
                  <Th>Objet</Th>
                  <Th>Détail</Th>
                  <Th>Confidentiel</Th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((entry) => {
                  const user = usersById.get(entry.userId);
                  return (
                    <tr key={entry.id} className={entry.confidential ? "bg-accent-soft/20" : ""}>
                      <Td className="whitespace-nowrap text-[11px] text-muted">{fmtDateTime(entry.date)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[8.5px] font-semibold text-ink-soft">
                            {user?.initiales ?? "SY"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11.5px] text-ink">{user?.nom ?? "Système"}</p>
                            <p className="text-[9.5px] text-faint">{user?.role ?? "—"}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                      </Td>
                      <Td className="max-w-[230px] truncate text-[11.5px] text-ink-soft" title={entry.target}>
                        {entry.target}
                      </Td>
                      <Td className="max-w-[280px] truncate text-[11px] text-muted" title={entry.details}>
                        {entry.details}
                      </Td>
                      <Td>
                        {entry.confidential ? (
                          <Badge tone="accent">
                            <LockKeyhole className="size-2.5" />
                            Client
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-faint">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {!filteredAudit.length && (
                  <tr>
                    <Td colSpan={6} className="py-8 text-center text-[12px] text-muted">
                      Aucune entrée ne correspond aux filtres.
                    </Td>
                  </tr>
                )}
              </tbody>
            </TableShell>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-faint">
              <p className="flex items-center gap-1.5">
                <FileClock className="size-3.5" />
                Journal en ajout seul : chaque export et modification est enregistré.
              </p>
              <p>
                Dernière entrée :{" "}
                {state.audit.length ? fmtDateTime(state.audit[0].date) : "—"}
              </p>
            </div>
          </Card>
        </div>
      )}

      {isAdmin && (
        <Card className="mt-4 border-danger/25">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">
                <RotateCcw className="size-3.5" />
                Zone de démonstration
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                Restaure les 200 hôtels fictifs, les KPI, transactions, benchmarks, imports et
                utilisateurs d’origine. Les saisies locales seront perdues.
              </p>
            </div>
            <Button variant="danger" size="md" onClick={() => setResetOpen(true)}>
              <RotateCcw />
              Réinitialiser la démo
            </Button>
          </div>
        </Card>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-faint">
        <p className="flex items-center gap-1.5">
          <KeyRound className="size-3" />
          NOVA Observatoire · Environnement de démonstration · Contrôles d’accès simulés
        </p>
        <p>Les données affichées sont fictives et clairement identifiées.</p>
      </footer>

      {inviteOpen && <UserDialog open={inviteOpen} onOpenChange={setInviteOpen} />}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Réinitialiser la démonstration ?"
            description="Cette action supprime toutes les modifications locales et recharge le jeu de données initial."
          />
          <DialogBody>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Les hôtels créés, imports, tâches, benchmarks et changements de rôles seront perdus.
              Vous pourrez recharger un fichier ou saisir une fiche à nouveau après la
              réinitialisation.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              <RotateCcw />
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
