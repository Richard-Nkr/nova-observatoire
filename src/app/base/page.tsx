"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Database,
  FileText,
  Landmark,
  MapPin,
  Presentation,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { BASE_INFO } from "@/lib/demo";
import { fmtInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader, ProgressBar, SectionTitle, StatTile } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";

interface BaseDescription {
  id: string;
  nom: string;
  source: string;
  role: string;
  lignes: number;
  champs: string;
  completude: number;
  icon: React.ReactNode;
  href?: string;
  vide?: boolean;
}

export default function BasePage() {
  const { state } = useStore();

  const identities = state.identities.length;
  const exploitations = state.exploitations.length;
  const transactions = state.transactions.length;
  const documentedExploitations = state.exploitations.filter((row) => row.ca != null).length;
  const documentedTransactions = state.transactions.filter(
    (transaction) => transaction.caAvant != null || transaction.caApres != null,
  ).length;
  const identityCoverage = identities
    ? state.identities.filter(
        (row) => row.chambres != null && row.surfaceTotale != null && row.equipementsHorsResto != null,
      ).length / identities
    : 0;

  const bases: BaseDescription[] = [
    {
      id: "hotel",
      nom: "BDD Hôtel",
      source: "Atout France + MISSIONS",
      role: "Socle de localisation : pays, région, département, ville et coordonnées communales.",
      lignes: state.hotels.length,
      champs: "Nom · région · ville · localisation · clés",
      completude: state.hotels.length
        ? state.hotels.filter((hotel) => hotel.region && hotel.ville && hotel.cles > 0).length / state.hotels.length
        : 0,
      icon: <MapPin className="size-4" />,
      href: "/hotels",
    },
    {
      id: "identite",
      nom: "BDD Identité",
      source: "Atout France + compilation",
      role: "Caractéristiques observées à la date du deal : marque, chambres, surfaces, équipements.",
      lignes: identities,
      champs: "Marque · chambres · suites · surfaces",
      completude: identityCoverage,
      icon: <Landmark className="size-4" />,
    },
    {
      id: "exploitation",
      nom: "BDD Exploitation",
      source: "MISSIONS",
      role: "Une ligne par exercice renseigné : chiffre d’affaires, EBITDA et marge.",
      lignes: exploitations,
      champs: "Exercice · phase · CA · EBITDA",
      completude: exploitations ? documentedExploitations / exploitations : 0,
      icon: <BarChart3 className="size-4" />,
      href: "/marche",
    },
    {
      id: "transactions",
      nom: "BDD Transaction",
      source: "CFNEWS + compilation",
      role: "Une ligne par opération : date, gammes et clés avant/après, CA avant/après.",
      lignes: transactions,
      champs: "Date · gammes · clés · CA · analyste",
      completude: transactions ? documentedTransactions / transactions : 0,
      icon: <ArrowLeftRight className="size-4" />,
      href: "/marche",
    },
    {
      id: "prix",
      nom: "BDD Prix / nuit",
      source: "MISSIONS",
      role: "Une ligne par prix observé, daté. Non présente dans le classeur fourni.",
      lignes: state.priceObservations.length,
      champs: "Date d’observation · prix · source",
      completude: 0,
      icon: <BedDouble className="size-4" />,
      vide: true,
    },
    {
      id: "mice",
      nom: "BDD MICE",
      source: "MISSIONS",
      role: "Une ligne par exercice : salles, surface MICE totale et plus grande salle.",
      lignes: state.miceObservations.length,
      champs: "Exercice · salles · surfaces",
      completude: 0,
      icon: <Presentation className="size-4" />,
      vide: true,
    },
    {
      id: "valorisation",
      nom: "BDD Valorisations NOVA",
      source: "MISSIONS",
      role: "Valorisation par année, produite dans le cadre des missions NOVA.",
      lignes: state.valuations.length,
      champs: "Exercice · valorisation · méthode",
      completude: 0,
      icon: <CircleDollarSign className="size-4" />,
      vide: true,
    },
  ];

  const totalRows = bases.reduce((total, base) => total + base.lignes, 0);
  const documentedBases = bases.filter((base) => !base.vide).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Données"
        title="Base de données"
        description="Vision arborescente des sept bases qui structurent l’observatoire. Les tables absentes du classeur source restent visibles, vides et explicitement non documentées."
        actions={
          <Badge tone="outline" className="px-2 py-1 text-[10px]">
            <Database className="size-3" /> {BASE_INFO.sourceFile}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Bases du schéma" value={String(bases.length)} sub={`${documentedBases} alimentées`} />
        <StatTile label="Actifs hôteliers" value={fmtInt(state.hotels.length)} sub={`${new Set(state.hotels.map((h) => h.region)).size} régions`} />
        <StatTile label="Lignes structurées" value={fmtInt(totalRows)} sub="hors tables vides" />
        <StatTile
          label="Exercice de référence"
          value={String(BASE_INFO.referenceYear)}
          sub={`Extraction ${BASE_INFO.generatedAt.slice(0, 10)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Card className="border-navy/15 bg-navy text-white">
          <div className="flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/45">
            <Database className="size-3.5" /> Table pivot
          </div>
          <h2 className="mt-2 font-serif text-2xl">BDD Hôtel</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/65">
            Chaque actif est identifié une seule fois puis relié aux observations d’identité, d’exploitation, de
            transaction, de prix, de MICE et de valorisation.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/12 pt-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-white/40">Actifs</div>
              <div className="font-serif text-2xl">{fmtInt(state.hotels.length)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-white/40">Régions</div>
              <div className="font-serif text-2xl">{new Set(state.hotels.map((hotel) => hotel.region)).size}</div>
            </div>
          </div>
          <Link
            href="/hotels"
            className="mt-5 inline-flex items-center gap-1 text-[10px] text-accent-soft hover:text-white"
          >
            Ouvrir le référentiel <ArrowUpRight className="size-3" />
          </Link>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {bases
            .filter((base) => base.id !== "hotel")
            .map((base) => (
              <div
                key={base.id}
                className="flex min-h-[132px] flex-col rounded-[3px] border border-line bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
                    <span className="grid size-6 place-items-center rounded-[2px] bg-paper text-navy">
                      {base.icon}
                    </span>
                    {base.nom}
                  </div>
                  {base.vide ? (
                    <Badge tone="grey">Vide</Badge>
                  ) : (
                    <span className="tabular text-[11px] font-semibold text-navy">{fmtInt(base.lignes)}</span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-muted">{base.role}</p>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[9px] text-faint">
                  <span>{base.source}</span>
                  {base.vide ? (
                    <span className="text-amber">non documenté</span>
                  ) : (
                    <span>{Math.round(base.completude * 100)} % renseigné</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      <Card padded={false}>
        <div className="p-4 pb-2">
          <SectionTitle hint="Volumétrie, champs clés et taux de complétude constatés">
            Contenu des sept bases
          </SectionTitle>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Base</Th>
              <Th>Source</Th>
              <Th align="right">Lignes</Th>
              <Th>Champs principaux</Th>
              <Th>Complétude</Th>
              <Th>Accès</Th>
            </tr>
          </thead>
          <tbody>
            {bases.map((base) => (
              <tr key={base.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="text-navy">{base.icon}</span>
                    <span className="font-medium text-ink">{base.nom}</span>
                  </div>
                </Td>
                <Td className="text-[10.5px] text-muted">{base.source}</Td>
                <Td align="right">
                  {base.vide ? <span className="text-faint">—</span> : fmtInt(base.lignes)}
                </Td>
                <Td className="text-[10.5px] text-muted">{base.champs}</Td>
                <Td>
                  {base.vide ? (
                    <Badge tone="grey">Non documenté</Badge>
                  ) : (
                    <div className="flex min-w-[140px] items-center gap-2">
                      <ProgressBar value={base.completude * 100} tone={base.completude > 0.8 ? "green" : "amber"} />
                      <span className="tabular w-9 text-right text-[10px]">
                        {Math.round(base.completude * 100)} %
                      </span>
                    </div>
                  )}
                </Td>
                <Td>
                  {base.href ? (
                    <Link href={base.href} className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline">
                      Explorer <ArrowUpRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-faint">V2 / connecteur MISSIONS</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle hint="Champs structurants du classeur source">Ce que la base documente</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { icon: <Building2 className="size-3.5" />, text: "245 actifs, 14 régions, 109 villes" },
              { icon: <MapPin className="size-3.5" />, text: "Localisation communale et gamme hôtelière" },
              { icon: <FileText className="size-3.5" />, text: "Surfaces, chambres, suites et couverts" },
              { icon: <CalendarDays className="size-3.5" />, text: "CA avant / après cession avec exercice" },
              { icon: <ArrowLeftRight className="size-3.5" />, text: "Gammes et clés avant / après opération" },
              { icon: <Landmark className="size-3.5" />, text: "Analyste et source par bloc de données" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-2 rounded-[2px] border border-line bg-paper/60 p-2">
                <span className="mt-0.5 text-accent">{item.icon}</span>
                <span className="text-[10.5px] leading-relaxed text-ink-soft">{item.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-amber/20 bg-amber-soft/40">
          <SectionTitle hint="Aucune valeur n’est extrapolée pour combler ces colonnes">
            Ce que la base ne documente pas
          </SectionTitle>
          <ul className="mt-3 space-y-1.5 text-[10.5px] leading-relaxed text-ink-soft">
            <li>ADR, taux d’occupation, RevPAR, EBITDA et prix par nuit.</li>
            <li>Prix de cession, prix par clé, acquéreur et cédant.</li>
            <li>Surfaces MICE annuelles, nombre de salles et plus grande salle.</li>
            <li>Valorisations NOVA et pipeline d’ouverture daté.</li>
          </ul>
          <p className="mt-3 border-t border-amber/20 pt-3 text-[10px] leading-relaxed text-muted">
            Ces dimensions sont présentes dans le schéma cible. Elles seront alimentées par les connecteurs MISSIONS,
            Atout France et CFNEWS en V2, sans jamais être déduites d’un autre champ.
          </p>
        </Card>
      </div>

      <p className="border-t border-line pt-3 text-[9.5px] text-faint">
        Source : {BASE_INFO.sourceFile} · feuille « {BASE_INFO.sourceSheet} » · générée le{" "}
        {BASE_INFO.generatedAt.slice(0, 10)}. Coordonnées au centroïde communal, jamais présentées comme une adresse
        exacte.
      </p>
    </div>
  );
}
