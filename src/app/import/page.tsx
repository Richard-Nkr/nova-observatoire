"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Database, Download, FileSpreadsheet, Leaf, ShieldCheck, Waypoints } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtInt } from "@/lib/format";
import { PageHeader, StatTile, Tabs, Card, SectionTitle } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { TableShell, Td, Th } from "@/components/ui/table";
import { ImportWizard } from "@/components/import/import-wizard";
import { ManualHotelForm } from "@/components/import/manual-hotel-form";

const CONNECTORS = [
  {
    nom: "SIRENE / INPI",
    description: "Vérification SIRET, raison sociale et dirigeants des exploitants.",
    statut: "V2",
    icon: Database,
  },
  {
    nom: "Atout France",
    description: "Classement officiel des hôtels et distinction Palace.",
    statut: "V2",
    icon: ShieldCheck,
  },
  {
    nom: "Base Adresse Nationale",
    description: "Géocodage d’appoint utilisé à l’import lorsque les coordonnées manquent.",
    statut: "Actif",
    icon: Waypoints,
  },
];

export default function ImportPage() {
  const { state } = useStore();
  const [tab, setTab] = useState("fichier");

  const stats = useMemo(() => {
    const lines = state.imports.reduce((total, batch) => total + batch.lignes, 0);
    const created = state.imports.reduce((total, batch) => total + batch.crees, 0);
    const merged = state.imports.reduce((total, batch) => total + batch.fusionnes, 0);
    return { lines, created, merged, nonDemo: state.hotels.filter((hotel) => !hotel.demo).length };
  }, [state.imports, state.hotels]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Données"
        title="Import & enrichissement"
        description="Intégrez un fichier client, arbitrez les doublons et complétez les fiches manquantes. Chaque valeur conserve sa source, sa date et son niveau de fiabilité."
        actions={
          <>
            <Link
              href="/modeles/modele-import-hotels.csv"
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-line-strong bg-surface px-3 text-[11.5px] font-medium text-ink hover:border-navy/40"
            >
              <Download className="size-3.5" /> Modèle CSV
            </Link>
            <Link
              href="/qualite"
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-navy px-3 text-[11.5px] font-medium text-white hover:bg-navy-soft"
            >
              Qualité des données <ArrowRight className="size-3.5" />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Lots importés" value={fmtInt(state.imports.length)} sub="Historique tracé" />
        <StatTile label="Lignes traitées" value={fmtInt(stats.lines)} sub={`${fmtInt(stats.created)} créations`} />
        <StatTile label="Fusions" value={fmtInt(stats.merged)} sub="Doublons rapprochés" accent={stats.merged > 0} />
        <StatTile label="Fiches ajoutées" value={fmtInt(stats.nonDemo)} sub="Hors base démo" accent />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "fichier", label: "Importer un fichier" },
          { value: "manuel", label: "Saisie manuelle" },
          { value: "historique", label: "Historique", count: state.imports.length },
        ]}
      />

      {tab === "fichier" && <ImportWizard />}
      {tab === "manuel" && <ManualHotelForm />}

      {tab === "historique" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <SectionTitle hint="Chaque lot conserve son auteur, sa date et le résultat de la validation.">
              Historique des imports
            </SectionTitle>
            <TableShell>
              <thead>
                <tr>
                  <Th>Fichier</Th>
                  <Th>Date</Th>
                  <Th>Auteur</Th>
                  <Th className="text-right">Lignes</Th>
                  <Th className="text-right">Créations</Th>
                  <Th className="text-right">Fusions</Th>
                  <Th className="text-right">Ignorés</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {state.imports.map((batch) => (
                  <tr key={batch.id}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        <FileSpreadsheet className="size-3.5 text-muted" />
                        {batch.fichier}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDate(batch.date)}</Td>
                    <Td>{batch.auteur}</Td>
                    <Td className="tabular text-right">{fmtInt(batch.lignes)}</Td>
                    <Td className="tabular text-right font-medium text-green">{fmtInt(batch.crees)}</Td>
                    <Td className="tabular text-right">{fmtInt(batch.fusionnes)}</Td>
                    <Td className="tabular text-right text-muted">{fmtInt(batch.ignores)}</Td>
                    <Td>
                      <Badge tone={batch.statut === "Terminé" ? "green" : "amber"}>{batch.statut}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            {!state.imports.length && (
              <p className="py-8 text-center text-[12px] text-muted">Aucun import enregistré.</p>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle hint="Les rapprochements sont proposés, jamais appliqués sans arbitrage.">
                Règles d’arbitrage
              </SectionTitle>
              <ol className="space-y-2.5 text-[11px] leading-relaxed text-ink-soft">
                <li className="flex gap-2">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-navy text-[9px] text-white">
                    1
                  </span>
                  Une fiche N1 existante n’est jamais écrasée par une source N2 ou N3.
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-navy text-[9px] text-white">
                    2
                  </span>
                  À niveau égal, la source la plus récente remplace l’ancienne valeur.
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-navy text-[9px] text-white">
                    3
                  </span>
                  Les valeurs remplacées restent dans l’historique des indicateurs et le journal d’audit.
                </li>
              </ol>
            </Card>

            <Card className="bg-paper/45">
              <SectionTitle>Traçabilité</SectionTitle>
              <p className="text-[11px] leading-relaxed text-muted">
                Un import ne crée jamais de valeur « vérifiée » par défaut. Le consultant choisit le niveau de
                fiabilité, la source, la date et, pour une estimation, l’hypothèse associée.
              </p>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <SectionTitle hint="Connecteurs externes prévus en version 2. Le géocodage BAN est déjà utilisé à l’import.">
          Connecteurs de données
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {CONNECTORS.map((connector) => {
            const Icon = connector.icon;
            return (
              <div key={connector.nom} className="rounded-[5px] border border-line bg-paper/45 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-7 place-items-center rounded-[4px] bg-white text-navy shadow-sm">
                    <Icon className="size-3.5" />
                  </span>
                  <Badge tone={connector.statut === "Actif" ? "green" : "outline"}>{connector.statut}</Badge>
                </div>
                <p className="mt-2 text-[12px] font-semibold text-ink">{connector.nom}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{connector.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
          <Leaf className="mt-0.5 size-3.5 shrink-0 text-accent" />
          Mode démonstration : les imports et saisies sont persistés dans le navigateur. En production, les mêmes
          règles s’appliquent sur PostgreSQL/PostGIS via les migrations fournies.
        </div>
      </Card>
    </div>
  );
}
