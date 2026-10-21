"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import type { Fiabilite, SourceRef } from "@/lib/types";
import { useStore } from "@/lib/store";
import { CURRENT_DATA_YEAR, EXTRACTION_DATE, YEARS } from "@/lib/constants";
import { fmtDate, fmtInt } from "@/lib/format";
import {
  applyDatabaseImport,
  buildDatabasePreview,
  exportDatabaseWorkbook,
  readDatabaseRows,
  type DatabaseApplyResult,
  type DatabaseRowStatus,
} from "@/lib/database-sync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, SectionTitle } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  DatabaseRowStatus,
  { label: string; tone: "green" | "grey" | "amber" | "danger" | "neutral" }
> = {
  update: { label: "Mise à jour", tone: "green" },
  unchanged: { label: "Inchangée", tone: "grey" },
  conflict: { label: "Conflit", tone: "amber" },
  unknown: { label: "ID inconnu", tone: "danger" },
  invalid: { label: "Invalide", tone: "danger" },
};

const RELIABILITY_OPTIONS = [
  { value: "N1", label: "N1 — observable / vérifié" },
  { value: "N2", label: "N2 — recherche approfondie" },
  { value: "N3", label: "N3 — estimation" },
];

/**
 * Aller-retour de la base : export d’un classeur éditable, réimport contrôlé
 * par ID stable, aperçu des changements puis application avec traçabilité.
 */
export function DatabaseSync() {
  const { state, currentUser, updateHotel, upsertKpi, addImport } = useStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [annee, setAnnee] = useState(CURRENT_DATA_YEAR);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DatabaseApplyResult | null>(null);

  const [sourceLabel, setSourceLabel] = useState("Base de travail NOVA");
  const [sourceDate, setSourceDate] = useState(EXTRACTION_DATE);
  const [sourceAuthor, setSourceAuthor] = useState(currentUser.nom);
  const [reliability, setReliability] = useState<Fiabilite>("N2");
  const [hypothesis, setHypothesis] = useState("");

  const source = useMemo<SourceRef | null>(() => {
    if (!sourceLabel.trim() || !sourceDate || !sourceAuthor.trim() || !reliability) {
      return null;
    }
    return {
      source: sourceLabel.trim(),
      dateSource: sourceDate,
      auteur: sourceAuthor.trim(),
      fiabilite: reliability,
      hypothese: hypothesis.trim() || undefined,
    };
  }, [sourceLabel, sourceDate, sourceAuthor, reliability, hypothesis]);

  const analysis = useMemo(() => {
    if (!rows || !source) return { preview: null, error: null } as const;
    try {
      return {
        preview: buildDatabasePreview(
          rows,
          state.hotels,
          state.kpis,
          source,
          fileName,
          annee,
        ),
        error: null,
      } as const;
    } catch (error) {
      return {
        preview: null,
        error: error instanceof Error ? error.message : "Le classeur est illisible.",
      } as const;
    }
  }, [rows, source, state.hotels, state.kpis, fileName, annee]);

  const preview = analysis.preview;

  const resetFile = () => {
    setRows(null);
    setFileName("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux (8 Mo maximum).", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const parsed = await readDatabaseRows(file);
      if (!parsed.rows.length) {
        toast({ title: "La feuille Hôtels ne contient aucune ligne.", tone: "error" });
        return;
      }
      setRows(parsed.rows);
      setFileName(parsed.fichier);
      setResult(null);
      toast({
        title: `${fmtInt(parsed.rows.length)} lignes analysées`,
        description: "Vérifiez la source puis les changements proposés.",
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "Impossible de lire le classeur",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    try {
      exportDatabaseWorkbook(state.hotels, state.kpis, annee);
      toast({
        title: `Base exportée — exercice ${annee}`,
        description: `${fmtInt(state.hotels.length)} hôtels et leurs KPI dans un classeur réimportable.`,
        tone: "success",
      });
    } catch {
      toast({ title: "L’export de la base a échoué.", tone: "error" });
    }
  };

  const handleApply = () => {
    if (!preview || !source) {
      toast({ title: "Chargez un classeur et renseignez la source.", tone: "error" });
      return;
    }
    if (reliability === "N3" && !hypothesis.trim()) {
      toast({ title: "Une hypothèse est obligatoire pour une mise à jour N3.", tone: "error" });
      return;
    }
    if (!preview.counts.update) {
      toast({ title: "Aucune modification à appliquer.", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const applied = applyDatabaseImport(preview, { updateHotel, upsertKpi, addImport });
      setResult(applied);
      toast({
        title: `${fmtInt(applied.updated)} fiche${applied.updated > 1 ? "s" : ""} mise${applied.updated > 1 ? "s" : ""} à jour`,
        description:
          applied.conflicts > 0
            ? `${fmtInt(applied.conflicts)} conflit(s) de fiabilité conservé(s).`
            : "Les valeurs ont été journalisées.",
        tone: applied.updated > 0 ? "success" : "error",
      });
    } catch {
      toast({ title: "L’application des modifications a échoué.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const previewRowCount = preview?.rows.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle hint="Un seul classeur pour consulter, modifier puis réimporter la base.">
          Aller-retour Excel
        </SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-paper/45 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-ink">1. Exporter la base de travail</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                  Tous les champs éditables et les KPI de l’exercice choisi. Feuille « Notice » incluse.
                </p>
              </div>
              <Select
                aria-label="Exercice à exporter"
                value={String(annee)}
                onChange={(value) => setAnnee(Number(value))}
                options={YEARS.map((year) => ({ value: String(year), label: String(year) }))}
                className="w-[86px] shrink-0"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleExport}>
                <Download className="size-3.5" />
                Exporter la base
              </Button>
              <span className="text-[10px] text-faint">
                {fmtInt(state.hotels.length)} hôtels · exercice {annee}
              </span>
            </div>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void loadFile(file);
            }}
            className={cn(
              "rounded-lg border border-dashed p-3.5 transition-colors",
              dragActive
                ? "border-accent bg-accent-soft/50"
                : "border-line-strong bg-paper/45",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-ink">2. Réimporter le classeur modifié</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                  Déposez le fichier Excel ou CSV. Les lignes sont rapprochées par ID stable.
                </p>
              </div>
              {fileName && (
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={resetFile}
                  aria-label="Retirer le fichier"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Choisir un fichier
              </Button>
              {fileName ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[10.5px] text-ink-soft">
                  <FileSpreadsheet className="size-3.5 shrink-0 text-accent" />
                  <span className="truncate">{fileName}</span>
                  {preview && (
                    <span className="shrink-0 text-faint">· {fmtInt(previewRowCount)} lignes</span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] text-faint">XLSX, XLS ou CSV · 8 Mo max.</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 border-t border-line pt-3 text-[10px] leading-relaxed text-muted sm:grid-cols-3">
          <p>
            <span className="font-semibold text-ink-soft">Cellule vide</span> = inchangé.
          </p>
          <p>
            <span className="font-semibold text-ink-soft">NULL</span> = effacer un champ nullable.
          </p>
          <p>
            <span className="font-semibold text-ink-soft">ID</span> = clé de rapprochement stable.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Ces informations s’appliquent aux lignes réellement modifiées.">
          Source du lot
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Source" required>
            <Input
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="Ex. base de travail NOVA"
            />
          </Field>
          <Field label="Date de la source" required>
            <Input
              type="date"
              value={sourceDate}
              onChange={(event) => setSourceDate(event.target.value)}
            />
          </Field>
          <Field label="Auteur" required>
            <Input
              value={sourceAuthor}
              onChange={(event) => setSourceAuthor(event.target.value)}
              placeholder="Consultant"
            />
          </Field>
          <Field label="Fiabilité" required>
            <Select
              aria-label="Niveau de fiabilité du lot"
              value={reliability}
              onChange={(value) => setReliability(value as Fiabilite)}
              options={RELIABILITY_OPTIONS}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Hypothèse"
            required={reliability === "N3"}
            hint={reliability === "N3" ? "Obligatoire pour une estimation" : "Optionnelle"}
          >
            <Input
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              placeholder="Méthode ou hypothèse associée à la mise à jour"
            />
          </Field>
          <p className="max-w-[360px] text-[10px] leading-relaxed text-muted">
            Une fiche N1 ne peut jamais être écrasée par une source N2 ou N3. À niveau égal, la
            valeur importée remplace l’ancienne et l’historique est conservé.
          </p>
        </div>
      </Card>

      {analysis.error && (
        <Card className="border-danger/20 bg-danger-soft/40">
          <div className="flex items-start gap-2 text-[12px] text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Le classeur ne peut pas être analysé.</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-ink-soft">{analysis.error}</p>
            </div>
          </div>
        </Card>
      )}

      {!rows && !analysis.error && (
        <Card className="border-dashed bg-paper/30">
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <RefreshCw className="size-5 text-faint" />
            <p className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-ink">
              L’aperçu apparaîtra ici
            </p>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-muted">
              Exportez la base, modifiez les cellules concernées, puis déposez le fichier pour
              contrôler les changements avant application.
            </p>
          </div>
        </Card>
      )}

      {preview && (
        <Card padded={false}>
          <div className="p-4 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionTitle hint="Rien n’est écrit avant votre validation.">
                  Aperçu des modifications
                </SectionTitle>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="green">{fmtInt(preview.counts.update)} à mettre à jour</Badge>
                  <Badge tone="grey">{fmtInt(preview.counts.unchanged)} inchangées</Badge>
                  <Badge tone="amber">{fmtInt(preview.counts.conflict)} conflit(s)</Badge>
                  <Badge tone="danger">{fmtInt(preview.counts.unknown)} ID inconnu(s)</Badge>
                  <Badge tone="danger">{fmtInt(preview.counts.invalid)} invalide(s)</Badge>
                </div>
              </div>
              <Button
                variant="accent"
                size="md"
                onClick={handleApply}
                disabled={busy || preview.counts.update === 0}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Appliquer · {fmtInt(preview.counts.update)}
              </Button>
            </div>
            {result && (
              <div className="mt-3 rounded-lg border border-green/20 bg-green-soft/50 px-3 py-2 text-[11px] text-green">
                {fmtInt(result.updated)} fiche(s) mise(s) à jour ·{" "}
                {fmtInt(result.ignored)} ignorée(s) · {fmtInt(result.conflicts)} conflit(s)
              </div>
            )}
          </div>

          <TableShell className="max-h-[420px]">
            <thead>
              <tr>
                <Th className="w-10 text-right">Ligne</Th>
                <Th>Hôtel</Th>
                <Th>Statut</Th>
                <Th>Modifications</Th>
                <Th>Contrôle</Th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => {
                const meta = STATUS_META[row.status];
                return (
                  <tr key={`${row.index}-${row.hotelId ?? "unknown"}`}>
                    <Td align="right" className="tabular text-faint">
                      {row.index}
                    </Td>
                    <Td>
                      <div className="min-w-0">
                        {row.hotelId ? (
                          <Link
                            href={`/hotels/${row.hotelId}`}
                            className="block truncate text-[11.5px] font-medium text-ink hover:text-accent"
                          >
                            {row.nom || "Sans nom"}
                          </Link>
                        ) : (
                          <span className="block truncate text-[11.5px] font-medium text-ink">
                            {row.nom || "Sans nom"}
                          </span>
                        )}
                        <span className="text-[10px] text-muted">{row.ville || "Ville non renseignée"}</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td>
                      <div className="max-w-[520px] text-[10.5px] leading-relaxed text-ink-soft">
                        {row.changes.length ? (
                          <p>
                            <span className="font-medium text-ink">Fiche :</span>{" "}
                            {row.changes.slice(0, 6).join(" · ")}
                            {row.changes.length > 6 && ` +${row.changes.length - 6}`}
                          </p>
                        ) : null}
                        {row.kpiChanges.length ? (
                          <p className={row.changes.length ? "mt-0.5" : undefined}>
                            <span className="font-medium text-ink">KPI :</span>{" "}
                            {row.kpiChanges.slice(0, 6).join(" · ")}
                            {row.kpiChanges.length > 6 && ` +${row.kpiChanges.length - 6}`}
                          </p>
                        ) : null}
                        {!row.changes.length && !row.kpiChanges.length && (
                          <span className="text-faint">Aucun changement</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="max-w-[320px] text-[10px] leading-relaxed">
                        {row.errors.length > 0 && (
                          <p className="text-danger">{row.errors.join(" ")}</p>
                        )}
                        {row.conflictReason && (
                          <p className="text-amber">{row.conflictReason}</p>
                        )}
                        {!row.errors.length && !row.conflictReason && row.status === "unknown" && (
                          <p className="text-danger">Vérifiez la colonne ID ou le couple Nom + Ville.</p>
                        )}
                        {!row.errors.length && !row.conflictReason && row.status !== "unknown" && (
                          <span className="text-faint">—</span>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[10px] text-muted">
            <span>
              Fichier : <span className="text-ink-soft">{preview.fichier}</span> · exercice de
              référence {preview.annee} · source {preview.source.fiabilite}
            </span>
            <span>Date de source : {fmtDate(preview.source.dateSource)}</span>
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2 border-t border-line pt-3 text-[9.5px] leading-relaxed text-faint">
        <ArrowRight className="mt-0.5 size-3 shrink-0 text-accent" />
        Les hôtels absents du fichier ne sont jamais supprimés. Pour ajouter un actif, utilisez la
        fiche « Ajouter un hôtel » ; pour les imports de sources externes, utilisez l’onglet
        « Importer un fichier ».
      </p>
    </div>
  );
}
