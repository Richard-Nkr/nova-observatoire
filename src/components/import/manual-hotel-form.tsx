"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Calculator, Check, Sparkles } from "lucide-react";
import type { Categorie, Fiabilite, HotelType, SourceRef } from "@/lib/types";
import {
  buildHotelInput,
  emptyEquipements,
  gammeForCategory,
  zoneRevparMedian,
} from "@/lib/hotel-utils";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  HOTEL_TYPES,
  MARKET_ZONES,
  RELIABILITY_META,
} from "@/lib/constants";
import { fmtEuro, fmtInt } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Toggle } from "@/components/ui/field";
import { Card, SectionTitle } from "@/components/ui/misc";

const today = () => new Date().toISOString().slice(0, 10);

export function ManualHotelForm() {
  const { state, currentUser, createHotel, upsertKpi } = useStore();
  const { toast } = useToast();

  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [adresse, setAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [departement, setDepartement] = useState("");
  const [region, setRegion] = useState("");
  const [categorie, setCategorie] = useState<Categorie>(4);
  const [type, setType] = useState<HotelType>("Business");
  const [groupe, setGroupe] = useState("");
  const [cles, setCles] = useState("");
  const [anneeOuverture, setAnneeOuverture] = useState("");
  const [anneeRenovation, setAnneeRenovation] = useState("");
  const [surfaceFnb, setSurfaceFnb] = useState("");
  const [couvertsInterieur, setCouvertsInterieur] = useState("");
  const [couvertsExterieur, setCouvertsExterieur] = useState("");
  const [spa, setSpa] = useState(false);
  const [piscine, setPiscine] = useState(false);
  const [gastro, setGastro] = useState(false);
  const [mice, setMice] = useState(false);

  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceDate, setSourceDate] = useState(today);
  const [sourceAuthor, setSourceAuthor] = useState(currentUser.nom);
  const [reliability, setReliability] = useState<Fiabilite | "">("");
  const [hypothesis, setHypothesis] = useState("");
  const [annee, setAnnee] = useState(2025);
  const [createEstimate, setCreateEstimate] = useState(true);

  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; nom: string; estimatedCa: number | null } | null>(null);

  const keys = Number(cles) || 0;
  const zoneMedian = region ? zoneRevparMedian(state.hotels, state.kpis, region, annee) : null;
  const zoneCount = region ? state.hotels.filter((hotel) => hotel.region === region).length : 0;
  const estimatedCa = zoneMedian && keys > 0 ? Math.round(zoneMedian * keys * 365) : null;
  const estimatedSurface =
    couvertsInterieur || couvertsExterieur
      ? Math.round((Number(couvertsInterieur) || 0) * 2.75 + (Number(couvertsExterieur) || 0) * 2)
      : null;

  const reset = () => {
    setNom("");
    setVille("");
    setAdresse("");
    setCodePostal("");
    setDepartement("");
    setRegion("");
    setCategorie(4);
    setType("Business");
    setGroupe("");
    setCles("");
    setAnneeOuverture("");
    setAnneeRenovation("");
    setSurfaceFnb("");
    setCouvertsInterieur("");
    setCouvertsExterieur("");
    setSpa(false);
    setPiscine(false);
    setGastro(false);
    setMice(false);
    setSourceLabel("");
    setSourceDate(today());
    setSourceAuthor(currentUser.nom);
    setReliability("");
    setHypothesis("");
  };

  const submit = async () => {
    if (!nom.trim() || !ville.trim() || !region) {
      toast({ title: "Le nom, la ville et la région sont obligatoires.", tone: "error" });
      return;
    }
    if (!Number.isFinite(keys) || keys <= 0) {
      toast({ title: "Le nombre de clés doit être supérieur à zéro.", tone: "error" });
      return;
    }
    if (!sourceLabel.trim() || !sourceDate || !sourceAuthor.trim() || !reliability) {
      toast({ title: "La source, sa date, son auteur et sa fiabilité sont obligatoires.", tone: "error" });
      return;
    }
    if (reliability === "N3" && !hypothesis.trim()) {
      toast({ title: "Précisez l’hypothèse qui fonde cette fiche estimée.", tone: "error" });
      return;
    }

    setSaving(true);
    try {
      const source: SourceRef = {
        source: sourceLabel.trim(),
        dateSource: sourceDate,
        auteur: sourceAuthor.trim(),
        fiabilite: reliability,
        hypothese: hypothesis.trim() || undefined,
      };
      const equipements = {
        ...emptyEquipements(),
        spa,
        restaurantGastro: gastro,
        piscineInterieure: piscine,
        mice,
        couvertsInterieur: Number(couvertsInterieur) || null,
        couvertsExterieur: Number(couvertsExterieur) || null,
      };
      const hotel = createHotel(
        buildHotelInput({
          nom: nom.trim(),
          ville: ville.trim(),
          adresse: adresse.trim(),
          codePostal: codePostal.trim(),
          departement: departement.trim(),
          region,
          categorie,
          gamme: gammeForCategory(categorie),
          type,
          groupe: groupe.trim() || "Indépendant",
          cles: keys,
          anneeOuverture: Number(anneeOuverture) || null,
          anneeRenovation: Number(anneeRenovation) || null,
          surfaceFnb: estimatedSurface && !surfaceFnb ? estimatedSurface : Number(surfaceFnb) || null,
          equipements,
          source,
        }),
      );

      let estimatedForHotel: number | null = null;
      if (createEstimate && estimatedCa) {
        const estimateSource: SourceRef = {
          source: "Estimation Nova — RevPAR médian de zone",
          dateSource: today(),
          auteur: currentUser.nom,
          fiabilite: "N3",
          hypothese: `CA estimé = ${fmtInt(keys)} clés × RevPAR médian ${annee} de ${region} (${fmtEuro(
            zoneMedian ?? 0,
          )}) × 365 jours. Médiane calculée sur ${zoneCount} hôtel(s) de la zone.`,
        };
        const result = upsertKpi({
          hotelId: hotel.id,
          annee,
          values: { caTotal: estimatedCa, revpar: zoneMedian },
          source: estimateSource,
        });
        if (result.ok) estimatedForHotel = estimatedCa;
      }

      setCreated({ id: hotel.id, nom: hotel.nom, estimatedCa: estimatedForHotel });
      toast({ title: "Fiche hôtel créée.", tone: "success" });
      reset();
    } catch {
      toast({ title: "La fiche n’a pas pu être créée.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-green text-white">
            <Check className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-[22px] text-ink">{created.nom}</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              La fiche a été ajoutée à l’observatoire avec sa source et son niveau de fiabilité.
            </p>
            {created.estimatedCa && (
              <p className="mt-2 rounded-[4px] border border-line bg-paper/80 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                Un indicateur N3 de {fmtEuro(created.estimatedCa)} a été créé pour l’exercice {annee}. Il est
                identifié comme une estimation et n’est jamais présenté comme une donnée vérifiée.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/hotels/${created.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-navy px-3 text-[11.5px] font-medium text-white hover:bg-navy-soft"
              >
                Ouvrir la fiche <ArrowUpRight className="size-3.5" />
              </Link>
              <Button variant="outline" onClick={() => setCreated(null)}>
                Saisir un autre hôtel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <Card>
          <SectionTitle hint="Les champs non renseignés restent vides : aucune valeur n’est inventée.">
            Identité de l’hôtel
          </SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nom de l’hôtel" required>
              <Input value={nom} onChange={(event) => setNom(event.target.value)} placeholder="Ex. Hôtel des Tilleuls" />
            </Field>
            <Field label="Ville" required>
              <Input value={ville} onChange={(event) => setVille(event.target.value)} placeholder="Ex. Courbevoie" />
            </Field>
            <Field label="Adresse">
              <Input value={adresse} onChange={(event) => setAdresse(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code postal">
                <Input value={codePostal} onChange={(event) => setCodePostal(event.target.value)} />
              </Field>
              <Field label="Département">
                <Input value={departement} onChange={(event) => setDepartement(event.target.value)} />
              </Field>
            </div>
            <Field label="Région" required>
              <Select
                value={region}
                onChange={setRegion}
                placeholder="Choisir une région"
                options={MARKET_ZONES.filter((zone) => zone !== "France métropolitaine").map((zone) => ({
                  value: zone,
                  label: zone,
                }))}
              />
            </Field>
            <Field label="Catégorie" required>
              <Select
                value={String(categorie)}
                onChange={(value) => setCategorie(value === "Palace" ? "Palace" : (Number(value) as Categorie))}
                options={CATEGORIES.map((item) => ({ value: String(item), label: CATEGORY_LABEL[String(item)] }))}
              />
            </Field>
            <Field label="Type">
              <Select
                value={type}
                onChange={(value) => setType(value as HotelType)}
                options={HOTEL_TYPES.map((item) => ({ value: item, label: item }))}
              />
            </Field>
            <Field label="Groupe / propriétaire">
              <Input
                value={groupe}
                onChange={(event) => setGroupe(event.target.value)}
                placeholder="Indépendant si non renseigné"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Capacité et équipements observés lors de la mission.">
            Capacité & équipements
          </SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nombre de clés" required>
              <Input
                type="number"
                min={1}
                value={cles}
                onChange={(event) => setCles(event.target.value)}
                placeholder="Ex. 120"
              />
            </Field>
            <Field label="Ouverture (année)">
              <Input
                type="number"
                value={anneeOuverture}
                onChange={(event) => setAnneeOuverture(event.target.value)}
                placeholder="Ex. 1998"
              />
            </Field>
            <Field label="Dernière rénovation">
              <Input
                type="number"
                value={anneeRenovation}
                onChange={(event) => setAnneeRenovation(event.target.value)}
                placeholder="Ex. 2022"
              />
            </Field>
            <Field label="Surface F&B (m²)" hint={estimatedSurface ? `Estimation : ${fmtInt(estimatedSurface)} m²` : undefined}>
              <Input
                type="number"
                value={surfaceFnb}
                onChange={(event) => setSurfaceFnb(event.target.value)}
                placeholder={estimatedSurface ? `Est. ${estimatedSurface}` : ""}
              />
            </Field>
            <Field label="Couverts intérieurs">
              <Input
                type="number"
                value={couvertsInterieur}
                onChange={(event) => setCouvertsInterieur(event.target.value)}
              />
            </Field>
            <Field label="Couverts extérieurs">
              <Input
                type="number"
                value={couvertsExterieur}
                onChange={(event) => setCouvertsExterieur(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Toggle checked={spa} onChange={setSpa} label="Spa" />
            <Toggle checked={piscine} onChange={setPiscine} label="Piscine" />
            <Toggle checked={gastro} onChange={setGastro} label="Restaurant gastronomique" />
            <Toggle checked={mice} onChange={setMice} label="MICE / séminaires" />
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Obligatoire pour chaque fiche et chaque indicateur.">Source & fiabilité</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Source" required>
              <Input
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                placeholder="Ex. visite de site, rapport annuel, presse…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de la source" required>
                <Input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} />
              </Field>
              <Field label="Exercice">
                <Select
                  value={String(annee)}
                  onChange={(value) => setAnnee(Number(value))}
                  options={[2025, 2024, 2023, 2022, 2021].map((year) => ({ value: String(year), label: String(year) }))}
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
            <Field label="Hypothèse (N3)" hint="Obligatoire si N3" className="md:col-span-2">
              <Input
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="Méthode, source indirecte, limites de l’estimation…"
              />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10.5px] text-muted">
            La fiche sera marquée comme non-démo et tracée dans le journal d’audit.
          </p>
          <Button variant="accent" onClick={() => void submit()} disabled={saving}>
            {saving ? "Création…" : "Créer la fiche hôtel"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <SectionTitle hint="Aide à la décision, jamais une donnée vérifiée.">
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="size-3.5" /> Estimateur
            </span>
          </SectionTitle>
          <div className="rounded-[5px] border border-line bg-paper/65 p-3">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              CA théorique de l’exercice {annee}
            </p>
            <p className="mt-1 font-serif text-[28px] leading-none text-navy">
              {estimatedCa ? fmtEuro(estimatedCa) : "—"}
            </p>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              {zoneMedian
                ? `${fmtInt(keys)} clés × RevPAR médian ${fmtEuro(zoneMedian)} × 365 jours.`
                : "Renseignez la région et le nombre de clés pour calculer l’estimation."}
              {zoneMedian && zoneCount > 0 ? ` Médiane sur ${zoneCount} hôtel(s) de la zone.` : ""}
            </p>
            {estimatedCa && (
              <div className="mt-2 flex items-center gap-1.5">
                <Badge tone="grey">N3 · estimé</Badge>
                <span className="text-[10px] text-muted">Hypothèse tracée</span>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-[5px] border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Surface F&B théorique
                </p>
                <p className="mt-1 font-serif text-[22px] leading-none text-ink">
                  {estimatedSurface ? `${fmtInt(estimatedSurface)} m²` : "—"}
                </p>
              </div>
              {estimatedSurface && !surfaceFnb && (
                <Button variant="outline" size="sm" onClick={() => setSurfaceFnb(String(estimatedSurface))}>
                  Appliquer
                </Button>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              2,75 m² par couvert intérieur + 2 m² par couvert extérieur. Ratio prudent, à corriger par le
              consultant.
            </p>
          </div>

          <div className="mt-3">
            <Checkbox
              checked={createEstimate}
              onChange={setCreateEstimate}
              disabled={!estimatedCa}
              label={
                <span className="leading-relaxed">
                  Créer un indicateur de CA <span className="font-medium">N3 estimé</span> pour l’exercice {annee}.
                </span>
              }
            />
          </div>
        </Card>

        <Card className="bg-paper/45">
          <SectionTitle>Méthode</SectionTitle>
          <ul className="space-y-2 text-[10.5px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
              Le RevPAR médian est calculé sur les hôtels de la région disposant d’un RevPAR pour l’exercice choisi.
            </li>
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
              L’estimation ne remplace jamais une valeur existante N1 : le store applique la règle de conflit.
            </li>
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
              Toute valeur estimée est grisée, italique et accompagnée de son hypothèse dans les exports.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
