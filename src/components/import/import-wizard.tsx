"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Merge,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { Fiabilite, Hotel, SourceRef } from "@/lib/types";
import {
  findDuplicate,
  geocodeAddress,
  hotelOverridesFromImport,
  IMPORT_FIELDS,
  mapImportRow,
  suggestMapping,
  type ImportFieldKey,
  type ParsedImportRow,
} from "@/lib/import";
import { buildHotelInput } from "@/lib/hotel-utils";
import { RELIABILITY_META } from "@/lib/constants";
import { fmtInt } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, SectionTitle } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const MAPPING_KEY = "nova-import-mapping-v1";
const PREVIEW_LIMIT = 15;
const GEOCODE_LIMIT = 30;
const MAX_ROWS = 1000;

type ImportAction = "create" | "merge" | "ignore";
type Mapping = Partial<Record<ImportFieldKey, string>>;

function readFile(file: File): Promise<Record<string, string>[]> {
  return file.arrayBuffer().then((buffer) => {
    let workbook: XLSX.WorkBook;
    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      const delimiter = firstLine.includes(";") ? ";" : ",";
      workbook = XLSX.read(text, { type: "string", FS: delimiter });
    } else {
      workbook = XLSX.read(buffer, { type: "array" });
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
      raw: false,
    });
  });
}

function sameValue(hotel: Hotel, row: ParsedImportRow, key: ImportFieldKey): boolean {
  if (key === "categorie") return String(hotel.categorie) === String(row.categorie);
  if (key === "cles") return hotel.cles === row.cles;
  if (key === "nom") return hotel.nom === row.nom;
  if (key === "ville") return hotel.ville === row.ville;
  return true;
}

export function ImportWizard() {
  const { state, currentUser, createHotel, updateHotel, upsertKpi, addImport } = useStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [remembered, setRemembered] = useState<Mapping>({});
  const [resolutions, setResolutions] = useState<Record<number, ImportAction>>({});
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    fichier: string;
    lignes: number;
    crees: number;
    fusionnes: number;
    ignores: number;
    kpiBloques: number;
    geocodes: number;
  } | null>(null);

  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceAuthor, setSourceAuthor] = useState(currentUser.nom);
  const [reliability, setReliability] = useState<Fiabilite | "">("");
  const [hypothesis, setHypothesis] = useState("");
  const [annee, setAnnee] = useState(2025);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MAPPING_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRemembered(JSON.parse(raw) as Mapping);
      }
    } catch {
      // Un mapping illisible est simplement ignoré.
    }
  }, []);

  const parsedRows = useMemo(
    () => rows.map((row, index) => mapImportRow(row, mapping, index)),
    [rows, mapping],
  );

  const duplicates = useMemo(
    () => parsedRows.map((row) => findDuplicate(row, state.hotels)),
    [parsedRows, state.hotels],
  );

  const duplicateCount = duplicates.filter(Boolean).length;

  const invalidRow = (row: ParsedImportRow) =>
    !row.nom.trim() ||
    !row.ville.trim() ||
    !mapping.categorie ||
    !row.categorieValide ||
    row.cles === null ||
    row.cles <= 0;

  const invalidCount = parsedRows.filter(invalidRow).length;

  const actionFor = (row: ParsedImportRow, duplicate: Hotel | null): ImportAction => {
    if (invalidRow(row)) return "ignore";
    return resolutions[row.index] ?? (duplicate ? "merge" : "create");
  };

  const resetFile = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResolutions({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux (8 Mo maximum).", tone: "error" });
      return;
    }
    try {
      const parsed = await readFile(file);
      if (!parsed.length) {
        toast({ title: "Le fichier ne contient aucune ligne exploitable.", tone: "error" });
        return;
      }
      if (parsed.length > MAX_ROWS) {
        toast({ title: `Le fichier dépasse ${fmtInt(MAX_ROWS)} lignes. Découpez-le avant import.`, tone: "error" });
        return;
      }
      const nextHeaders = Object.keys(parsed[0]);
      const suggested = suggestMapping(nextHeaders);
      const merged: Mapping = { ...suggested };
      for (const field of IMPORT_FIELDS) {
        const saved = remembered[field.key];
        if (saved && nextHeaders.includes(saved)) merged[field.key] = saved;
      }
      setFileName(file.name);
      setHeaders(nextHeaders);
      setRows(parsed);
      setMapping(merged);
      setResolutions({});
      setSummary(null);
    } catch {
      toast({ title: "Impossible de lire le fichier. Utilisez un CSV ou un classeur Excel.", tone: "error" });
    }
  };

  const updateMapping = (key: ImportFieldKey, column: string) => {
    const next: Mapping = { ...mapping };
    if (column) next[key] = column;
    else delete next[key];
    setMapping(next);
    setResolutions({});
    try {
      window.localStorage.setItem(MAPPING_KEY, JSON.stringify(next));
      setRemembered(next);
    } catch {
      // Le mapping reste utilisable en mémoire.
    }
  };

  const source = (): SourceRef | null => {
    if (!sourceLabel.trim() || !sourceDate || !sourceAuthor.trim() || !reliability) return null;
    return {
      source: sourceLabel.trim(),
      dateSource: sourceDate,
      auteur: sourceAuthor.trim(),
      fiabilite: reliability,
      hypothese: hypothesis.trim() || undefined,
    };
  };

  const applyImport = async () => {
    if (!parsedRows.length) return;
    if (!mapping.nom || !mapping.ville || !mapping.categorie || !mapping.cles) {
      toast({ title: "Mappez au minimum le nom, la ville, la catégorie et le nombre de clés.", tone: "error" });
      return;
    }
    if (!source()) {
      toast({ title: "La source, sa date, son auteur et sa fiabilité sont obligatoires.", tone: "error" });
      return;
    }
    if (reliability === "N3" && !hypothesis.trim()) {
      toast({ title: "Une hypothèse est obligatoire pour une valeur estimée N3.", tone: "error" });
      return;
    }
    const trace = source();
    if (!trace) return;

    const actionable = parsedRows.filter((row) => {
      const action = actionFor(row, duplicates[row.index]);
      return !invalidRow(row) && action !== "ignore";
    });
    if (!actionable.length) {
      toast({ title: "Aucune ligne à importer : vérifiez le mapping et les actions.", tone: "error" });
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: actionable.length });
    let crees = 0;
    let fusionnes = 0;
    let ignores = parsedRows.length - actionable.length;
    let kpiBloques = 0;
    let geocodes = 0;
    const geocodeCache = new Map<string, { latitude: number; longitude: number } | null>();
    const shouldGeocode = actionable.length <= GEOCODE_LIMIT;

    try {
      for (let index = 0; index < actionable.length; index += 1) {
        const row = actionable[index];
        const duplicate = duplicates[row.index];
        const action = actionFor(row, duplicate);

        let coordinates: { latitude: number; longitude: number } | null =
          row.latitude !== null && row.longitude !== null
            ? { latitude: row.latitude, longitude: row.longitude }
            : null;

        if (!coordinates && shouldGeocode && row.ville) {
          const key = `${row.adresse}|${row.codePostal}|${row.ville}`;
          if (!geocodeCache.has(key)) {
            geocodeCache.set(key, await geocodeAddress(row.adresse, row.codePostal, row.ville));
          }
          const found = geocodeCache.get(key) ?? null;
          if (found) {
            coordinates = { latitude: found.latitude, longitude: found.longitude };
            geocodes += 1;
          }
        }

        if (action === "merge" && duplicate) {
          if (duplicate.source.fiabilite === "N1" && trace.fiabilite !== "N1") {
            ignores += 1;
          } else {
            const patch: Partial<Hotel> = { source: trace };
            if (mapping.nom && row.nom) patch.nom = row.nom;
            if (mapping.ville && row.ville) patch.ville = row.ville;
            if (mapping.adresse && row.adresse) patch.adresse = row.adresse;
            if (mapping.codePostal && row.codePostal) patch.codePostal = row.codePostal;
            if (mapping.departement && row.departement) patch.departement = row.departement;
            if (mapping.region && row.region) patch.region = row.region;
            if (mapping.categorie && !sameValue(duplicate, row, "categorie")) patch.categorie = row.categorie;
            if (mapping.gamme && row.gamme) patch.gamme = row.gamme as Hotel["gamme"];
            if (mapping.groupe && row.groupe) patch.groupe = row.groupe;
            if (mapping.enseigne && row.enseigne) patch.enseigne = row.enseigne;
            if (mapping.cles && row.cles !== null) patch.cles = row.cles;
            if (mapping.anneeOuverture && row.anneeOuverture !== null) patch.anneeOuverture = row.anneeOuverture;
            if (mapping.anneeRenovation && row.anneeRenovation !== null) {
              patch.anneeRenovation = row.anneeRenovation;
            }
            if (coordinates) {
              patch.latitude = coordinates.latitude;
              patch.longitude = coordinates.longitude;
            }
            updateHotel(duplicate.id, patch);
            fusionnes += 1;

            const values = {
              caTotal: row.caTotal,
              adr: row.adr,
              to: row.to,
              revpar: row.revpar,
            };
            if (Object.values(values).some((value) => value !== null)) {
              const result = upsertKpi({
                hotelId: duplicate.id,
                annee,
                values,
                source: trace,
              });
              if (!result.ok) kpiBloques += 1;
            }
          }
        } else if (action === "create") {
          const created = createHotel(buildHotelInput(hotelOverridesFromImport(row, trace, coordinates)));
          crees += 1;
          const values = {
            caTotal: row.caTotal,
            adr: row.adr,
            to: row.to,
            revpar: row.revpar,
          };
          if (Object.values(values).some((value) => value !== null)) {
            const result = upsertKpi({ hotelId: created.id, annee, values, source: trace });
            if (!result.ok) kpiBloques += 1;
          }
        }

        setProgress({ done: index + 1, total: actionable.length });
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      addImport({
        fichier: fileName,
        lignes: parsedRows.length,
        crees,
        fusionnes,
        ignores,
        statut: "Terminé",
      });
      setSummary({
        fichier: fileName,
        lignes: parsedRows.length,
        crees,
        fusionnes,
        ignores,
        kpiBloques,
        geocodes,
      });
      toast({
        title: `${crees} fiche(s) créée(s), ${fusionnes} fusion(s)${ignores ? `, ${ignores} ligne(s) ignorée(s)` : ""}.`,
        tone: "success",
      });
      resetFile();
    } catch {
      toast({ title: "L’import a été interrompu. Les lignes déjà traitées ont été enregistrées.", tone: "error" });
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  return (
    <div className="space-y-4">
      {summary && (
        <Card className="border-green/30 bg-green-soft/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-7 place-items-center rounded-full bg-green text-white">
                <Check className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-green">Import terminé — {summary.fichier}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">
                  {fmtInt(summary.lignes)} lignes lues · {summary.crees} création(s) · {summary.fusionnes} fusion(s)
                  · {summary.ignores} ignore(s)
                  {summary.geocodes ? ` · ${summary.geocodes} adresse(s) géocodée(s)` : ""}.
                </p>
                {summary.kpiBloques > 0 && (
                  <p className="mt-1 text-[11px] text-amber">
                    {summary.kpiBloques} indicateur(s) non importé(s) : une valeur N1 existante ne peut pas être
                    remplacée par une source de fiabilité inférieure.
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSummary(null)}>
              <X className="size-3.5" /> Fermer
            </Button>
          </div>
        </Card>
      )}

      {!fileName && (
        <Card>
          <SectionTitle hint="CSV ou Excel, première feuille du classeur. Les colonnes sont mappées vers la base, sans écrasement silencieux.">
            Importer un fichier
          </SectionTitle>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files[0];
              if (file) void loadFile(file);
            }}
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[5px] border border-dashed px-6 py-10 text-center transition-colors",
              dragActive ? "border-accent bg-accent-soft/50" : "border-line-strong bg-paper/45 hover:bg-paper",
            )}
          >
            <span className="grid size-10 place-items-center rounded-full bg-white text-navy shadow-sm">
              <Upload className="size-5" />
            </span>
            <span className="text-[13px] font-medium text-ink">
              Glissez un fichier ici ou cliquez pour parcourir
            </span>
            <span className="text-[11px] text-muted">CSV ou XLSX · 8 Mo max · 1 000 lignes max par lot</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
              }}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-[11px] text-muted">
              Champs minimum : nom, ville, catégorie et clés. Un modèle est disponible avec les intitulés attendus.
            </p>
            <a
              href="/modeles/modele-import-hotels.csv"
              download
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-navy hover:text-accent"
            >
              <Download className="size-3.5" /> Télécharger le modèle CSV
            </a>
          </div>
        </Card>
      )}

      {fileName && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-[4px] bg-navy-soft/10 text-navy">
                  <FileSpreadsheet className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{fileName}</p>
                  <p className="text-[10.5px] text-muted">
                    {fmtInt(rows.length)} ligne(s) · {headers.length} colonne(s) détectée(s)
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFile} disabled={busy}>
                <ArrowLeft className="size-3.5" /> Changer de fichier
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <SectionTitle hint="Le dernier mapping est mémorisé localement sur ce navigateur. Modifiez-le si les en-têtes changent.">
                Mapping des colonnes
              </SectionTitle>
              <div className="mt-3 grid gap-x-5 gap-y-2.5 md:grid-cols-2">
                {IMPORT_FIELDS.map((field) => {
                  const sample = mapping[field.key] ? rows.find((row) => String(row[mapping[field.key]!] ?? "").trim())?.[mapping[field.key]!] : "";
                  return (
                    <label key={field.key} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
                      <span className="text-[10.5px] text-ink-soft">
                        {field.label}
                        {field.required && <span className="ml-0.5 text-danger">*</span>}
                      </span>
                      <div>
                        <Select
                          value={mapping[field.key] ?? ""}
                          onChange={(value) => updateMapping(field.key, value)}
                          placeholder="Non importé"
                          options={headers.map((header) => ({ value: header, label: header }))}
                          className="[&_select]:h-7 [&_select]:text-[11px]"
                        />
                        <p className="mt-0.5 truncate text-[9px] text-faint">
                          {sample ? `Ex. ${String(sample).slice(0, 48)}` : "—"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {(!mapping.nom || !mapping.ville || !mapping.categorie || !mapping.cles) && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-danger">
                  <ShieldAlert className="size-3.5" /> Mapping incomplet : nom, ville, catégorie et clés sont requis.
                </p>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <SectionTitle hint="Ces métadonnées s’appliquent à toutes les valeurs importées.">
                  Traçabilité
                </SectionTitle>
                <div className="mt-3 space-y-2.5">
                  <Field label="Source" required>
                    <Input
                      value={sourceLabel}
                      onChange={(event) => setSourceLabel(event.target.value)}
                      placeholder="Ex. fichier client, rapport annuel…"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Date de la source" required>
                      <Input
                        type="date"
                        value={sourceDate}
                        onChange={(event) => setSourceDate(event.target.value)}
                      />
                    </Field>
                    <Field label="Exercice des KPI">
                      <Select
                        value={String(annee)}
                        onChange={(value) => setAnnee(Number(value))}
                        options={[2025, 2024, 2023, 2022, 2021].map((year) => ({
                          value: String(year),
                          label: String(year),
                        }))}
                      />
                    </Field>
                  </div>
                  <Field label="Auteur" required>
                    <Input value={sourceAuthor} onChange={(event) => setSourceAuthor(event.target.value)} />
                  </Field>
                  <Field label="Fiabilité" required>
                    <Select
                      value={reliability}
                      onChange={(value) => setReliability(value as Fiabilite)}
                      placeholder="Choisir un niveau"
                      options={Object.entries(RELIABILITY_META).map(([key, meta]) => ({
                        value: key,
                        label: `${key} — ${meta.description}`,
                      }))}
                    />
                  </Field>
                  <Field label="Hypothèse / méthode (N3)" hint="Obligatoire pour une valeur estimée N3.">
                    <Input
                      value={hypothesis}
                      onChange={(event) => setHypothesis(event.target.value)}
                      placeholder="Ex. valeur estimée par ratio…"
                    />
                  </Field>
                </div>
                <div className="mt-3 rounded-[4px] border border-line bg-paper/70 p-2.5 text-[10px] leading-relaxed text-muted">
                  Une fiche N1 existante n’est jamais écrasée par une fusion N2 ou N3. Les indicateurs remplacés
                  restent dans l’historique ; les refus sont tracés dans le journal.
                </div>
              </Card>

              <Card>
                <SectionTitle>Contrôle avant import</SectionTitle>
                <dl className="mt-2 divide-y divide-line text-[11.5px]">
                  <div className="flex justify-between py-1.5">
                    <dt className="text-muted">Lignes valides</dt>
                    <dd className="tabular font-medium text-ink">{fmtInt(rows.length - invalidCount)}</dd>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-muted">Doublons détectés</dt>
                    <dd className="tabular font-medium text-amber">{fmtInt(duplicateCount)}</dd>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-muted">Lignes incomplètes</dt>
                    <dd className="tabular font-medium text-danger">{fmtInt(invalidCount)}</dd>
                  </div>
                </dl>
                <Button
                  variant="accent"
                  className="mt-3 w-full"
                  onClick={() => void applyImport()}
                  disabled={busy || !rows.length}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Import {progress.done}/{progress.total}
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" /> Lancer l’import
                    </>
                  )}
                </Button>
                <p className="mt-2 text-[10px] leading-relaxed text-muted">
                  {actionableCount(parsedRows, duplicates, resolutions, invalidRow)} ligne(s) seront créées ou
                  fusionnées. Les autres seront ignorées.
                </p>
              </Card>
            </div>
          </div>

          <Card>
            <SectionTitle
              hint={`Un doublon est proposé lorsque le nom est identique et que l’adresse, le code postal, la ville ou la distance (<100 m) concordent. Aperçu limité aux ${PREVIEW_LIMIT} premières lignes.`}
            >
              Aperçu et arbitrage des doublons
            </SectionTitle>
            <TableShell className="mt-3 max-h-[520px] overflow-auto">
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Hôtel importé</Th>
                  <Th>Ville</Th>
                  <Th className="text-right">Cat.</Th>
                  <Th className="text-right">Clés</Th>
                  <Th>Rapprochement</Th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, PREVIEW_LIMIT).map((row) => {
                  const duplicate = duplicates[row.index];
                  const action = actionFor(row, duplicate);
                  const invalid = invalidRow(row);
                  return (
                    <tr key={row.index} className={invalid ? "bg-danger-soft/25" : undefined}>
                      <Td>
                        <Select
                          value={action}
                          onChange={(value) =>
                            setResolutions((prev) => ({ ...prev, [row.index]: value as ImportAction }))
                          }
                          disabled={invalid || busy}
                          options={
                            duplicate
                              ? [
                                  { value: "merge", label: "Fusionner" },
                                  { value: "create", label: "Créer" },
                                  { value: "ignore", label: "Ignorer" },
                                ]
                              : [
                                  { value: "create", label: "Créer" },
                                  { value: "ignore", label: "Ignorer" },
                                ]
                          }
                          className="min-w-[118px] [&_select]:h-7 [&_select]:text-[10.5px]"
                        />
                      </Td>
                      <Td>
                        <p className="font-medium text-ink">{row.nom || <span className="text-danger">Nom absent</span>}</p>
                        <p className="text-[10px] text-muted">{row.adresse || "Adresse non fournie"}</p>
                      </Td>
                      <Td>{row.ville || <span className="text-danger">Ville absente</span>}</Td>
                      <Td className="text-right">{row.categorie}</Td>
                      <Td className="tabular text-right">{row.cles ?? "—"}</Td>
                      <Td>
                        {invalid ? (
                          <Badge tone="danger">Incomplète</Badge>
                        ) : duplicate ? (
                          <div>
                            <Badge tone="amber">
                              <Merge className="mr-1 size-2.5" /> Doublon probable
                            </Badge>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {duplicate.nom} · {duplicate.ville} · {duplicate.source.fiabilite}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-green">Nouvelle fiche</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            {!parsedRows.length && (
              <p className="py-6 text-center text-[12px] text-muted">Aucune ligne à prévisualiser.</p>
            )}
            {rows.length > PREVIEW_LIMIT && (
              <p className="mt-2 text-[10px] text-muted">
                + {fmtInt(rows.length - PREVIEW_LIMIT)} autre(s) ligne(s) seront traitées avec l’action proposée.
              </p>
            )}
          </Card>
        </>
      )}

      <div className="flex items-start gap-2 rounded-[4px] border border-line bg-paper/60 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>
          Aucune valeur n’est extrapolée ici : les cellules vides restent vides. Le géocodage BAN n’est utilisé que
          pour positionner les nouvelles fiches lorsque la latitude et la longitude ne sont pas fournies.
        </span>
      </div>
    </div>
  );
}

function actionableCount(
  rows: ParsedImportRow[],
  duplicates: (Hotel | null)[],
  resolutions: Record<number, ImportAction>,
  invalidRow: (row: ParsedImportRow) => boolean,
): number {
  return rows.filter((row) => {
    if (invalidRow(row)) return false;
    const action = resolutions[row.index] ?? (duplicates[row.index] ? "merge" : "create");
    return action !== "ignore";
  }).length;
}
