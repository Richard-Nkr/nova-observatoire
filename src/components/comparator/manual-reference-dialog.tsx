"use client";

import * as React from "react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, EXTRACTION_DATE } from "@/lib/constants";
import { fmtEuro, fmtInt } from "@/lib/format";
import type { Categorie, Fiabilite, ManualReference } from "@/lib/types";

function toInput(value: number | null, ratio = false): string {
  if (value == null) return "";
  return String(Number((ratio ? value * 100 : value).toFixed(1)));
}

function cleanNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Actif client fictif : saisi manuellement et conservé uniquement en mémoire.
 * Il ne crée ni hôtel ni KPI dans la base, afin de ne jamais polluer l'observatoire.
 */
export function ManualReferenceDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ManualReference | null;
  onSave: (reference: ManualReference) => void;
  onClear: () => void;
}) {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [nom, setNom] = React.useState(initial?.nom ?? "");
  const [ville, setVille] = React.useState(initial?.ville ?? "");
  const [categorie, setCategorie] = React.useState(String(initial?.categorie ?? 4));
  const [cles, setCles] = React.useState(initial ? String(initial.cles) : "");
  const [caTotal, setCaTotal] = React.useState(toInput(initial?.caTotal ?? null));
  const [adr, setAdr] = React.useState(toInput(initial?.adr ?? null));
  const [to, setTo] = React.useState(toInput(initial?.to ?? null, true));
  const [revpar, setRevpar] = React.useState(toInput(initial?.revpar ?? null));
  const [ebitdaPct, setEbitdaPct] = React.useState(toInput(initial?.ebitdaPct ?? null, true));
  const [note, setNote] = React.useState(toInput(initial?.note ?? null));
  const [source, setSource] = React.useState(initial?.source.source ?? "");
  const [dateSource, setDateSource] = React.useState(initial?.source.dateSource ?? EXTRACTION_DATE);
  const [auteur, setAuteur] = React.useState(initial?.source.auteur ?? currentUser.nom);
  const [fiabilite, setFiabilite] = React.useState<Fiabilite>(initial?.source.fiabilite ?? "N2");
  const [hypothese, setHypothese] = React.useState(initial?.source.hypothese ?? "");
  const [error, setError] = React.useState("");

  const keys = cleanNumber(cles);
  const caValue = cleanNumber(caTotal);
  const adrValue = cleanNumber(adr);
  const toValue = cleanNumber(to);
  const revparValue = cleanNumber(revpar);
  const ebitdaValue = cleanNumber(ebitdaPct);
  const noteValue = cleanNumber(note);
  const derivedRevpar =
    revparValue != null
      ? revparValue
      : adrValue != null && toValue != null
        ? adrValue * (toValue / 100)
        : null;
  const derivedCaParCle = caValue != null && keys ? caValue / keys : null;

  const submit = () => {
    if (!nom.trim()) return setError("Le nom de l'actif est obligatoire.");
    if (!ville.trim()) return setError("La ville est obligatoire.");
    if (!keys || keys <= 0) return setError("Le nombre de clés doit être supérieur à zéro.");
    if (!source.trim()) return setError("La source est obligatoire : aucune valeur sans traçabilité.");
    if (!dateSource) return setError("La date de la source est obligatoire.");
    if (!auteur.trim()) return setError("L'auteur de la collecte est obligatoire.");
    if (fiabilite === "N3" && !hypothese.trim()) {
      return setError("Une estimation N3 doit être accompagnée de son hypothèse de calcul.");
    }
    if (toValue != null && (toValue < 0 || toValue > 100)) {
      return setError("Le taux d'occupation doit être compris entre 0 et 100 %.");
    }
    if (ebitdaValue != null && (ebitdaValue < -100 || ebitdaValue > 100)) {
      return setError("La marge EBITDA doit être comprise entre -100 et 100 %.");
    }
    const reference: ManualReference = {
      nom: nom.trim(),
      ville: ville.trim(),
      categorie: categorie === "Palace" ? "Palace" : (Number(categorie) as Categorie),
      cles: Math.round(keys),
      caTotal: caValue,
      adr: adrValue,
      to: toValue != null ? toValue / 100 : null,
      revpar: revparValue,
      ebitdaPct: ebitdaValue != null ? ebitdaValue / 100 : null,
      note: noteValue,
      source: {
        source: source.trim(),
        dateSource,
        auteur: auteur.trim(),
        fiabilite,
        hypothese: hypothese.trim() || undefined,
      },
    };
    setError("");
    onSave(reference);
    toast({ title: "Actif de référence défini", description: reference.nom, tone: "success" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide className="max-w-3xl">
        <DialogHeader
          title="Actif client — référence manuelle"
          description="Saisie ponctuelle, non enregistrée dans la base. Toutes les valeurs restent tracées par leur source et leur fiabilité."
        />
        <DialogBody>
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Identité de l’actif
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom de l'actif" required className="sm:col-span-2">
                  <Input value={nom} onChange={(event) => setNom(event.target.value)} placeholder="Ex. Hôtel client — Courbevoie" />
                </Field>
                <Field label="Ville" required>
                  <Input value={ville} onChange={(event) => setVille(event.target.value)} placeholder="Courbevoie" />
                </Field>
                <Field label="Catégorie">
                  <Select
                    value={categorie}
                    onChange={setCategorie}
                    options={CATEGORIES.map((item) => ({
                      value: String(item),
                      label: item === "Palace" ? "Palace" : `${item}★`,
                    }))}
                  />
                </Field>
                <Field label="Nombre de clés" required>
                  <Input type="number" min={1} value={cles} onChange={(event) => setCles(event.target.value)} placeholder="180" />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Indicateurs de l’exercice
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="CA total" hint="€ HT">
                  <Input type="number" value={caTotal} onChange={(event) => setCaTotal(event.target.value)} placeholder="18400000" />
                </Field>
                <Field label="ADR" hint="€ HT">
                  <Input type="number" value={adr} onChange={(event) => setAdr(event.target.value)} placeholder="245" />
                </Field>
                <Field label="Taux d'occupation" hint="%">
                  <Input type="number" value={to} onChange={(event) => setTo(event.target.value)} placeholder="74,5" />
                </Field>
                <Field label="RevPAR" hint="€ HT">
                  <Input type="number" value={revpar} onChange={(event) => setRevpar(event.target.value)} placeholder="182" />
                </Field>
                <Field label="Marge EBITDA" hint="%">
                  <Input type="number" value={ebitdaPct} onChange={(event) => setEbitdaPct(event.target.value)} placeholder="31,5" />
                </Field>
                <Field label="Note en ligne" hint="/10">
                  <Input type="number" step="0.1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="8,6" />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border border-line bg-paper/50 px-3 py-2 text-[10.5px] text-muted">
                <span>RevPAR retenu : <strong className="text-ink">{derivedRevpar != null ? fmtEuro(derivedRevpar) : "—"}</strong></span>
                <span>CA / clé calculé : <strong className="text-ink">{derivedCaParCle != null ? fmtEuro(derivedCaParCle) : "—"}</strong></span>
                <span>Clés : <strong className="text-ink">{keys ? fmtInt(keys) : "—"}</strong></span>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Source & fiabilité
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Source" required className="sm:col-span-2">
                  <Input
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Ex. liasse fiscale 2025 transmise par le client"
                  />
                </Field>
                <Field label="Date de la source" required>
                  <Input type="date" value={dateSource} onChange={(event) => setDateSource(event.target.value)} />
                </Field>
                <Field label="Auteur" required>
                  <Input value={auteur} onChange={(event) => setAuteur(event.target.value)} />
                </Field>
                <Field label="Fiabilité">
                  <Select
                    value={fiabilite}
                    onChange={(value) => setFiabilite(value as Fiabilite)}
                    options={[
                      { value: "N1", label: "N1 — observable / vérifié" },
                      { value: "N2", label: "N2 — recherche approfondie" },
                      { value: "N3", label: "N3 — estimation" },
                    ]}
                  />
                </Field>
                <Field
                  label="Hypothèse"
                  hint={fiabilite === "N3" ? "obligatoire" : "facultatif"}
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={hypothese}
                    onChange={(event) => setHypothese(event.target.value)}
                    placeholder="Méthode de calcul ou hypothèse retenue…"
                  />
                </Field>
              </div>
            </section>

            {error && (
              <p className="border border-danger/30 bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
                {error}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          {initial && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => { onClear(); onOpenChange(false); }}>
              Retirer l’actif manuel
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="accent" onClick={submit}>
            Utiliser cet actif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
