"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { SearchInput, Select } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES } from "@/lib/constants";
import { fmtInt } from "@/lib/format";
import type { Categorie } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ajout d'un hôtel au panel. La sélection est plafonnée à 30 acteurs par le store.
 * Le premier hôtel ajouté devient automatiquement la référence du comparateur.
 */
export function AddHotelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, toggleBasket, setReference } = useStore();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [region, setRegion] = React.useState("");

  const regions = [...new Set(state.hotels.map((hotel) => hotel.region))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const results = state.hotels
    .filter((hotel) => {
      if (category && String(hotel.categorie) !== category) return false;
      if (region && hotel.region !== region) return false;
      if (!normalizedSearch) return true;
      return [hotel.nom, hotel.ville, hotel.groupe, hotel.enseigne, hotel.codePostal]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 80);

  const add = (hotelId: string, nom: string) => {
    if (state.basket.includes(hotelId)) return;
    if (state.basket.length >= 30) {
      toast({ title: "Panel complet", description: "Le comparateur est limité à 30 hôtels.", tone: "error" });
      return;
    }
    toggleBasket(hotelId);
    if (!state.referenceId) setReference(hotelId);
    toast({ title: "Hôtel ajouté au panel", description: nom, tone: "success" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader
          title="Ajouter un hôtel au panel"
          description={`${state.basket.length} / 30 acteurs sélectionnés. La recherche porte sur l'ensemble de l'observatoire.`}
        />
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Nom, ville, groupe, code postal…"
            className="min-w-[240px] flex-1"
          />
          <Select
            value={region}
            onChange={setRegion}
            options={[{ value: "", label: "Toutes les régions" }, ...regions.map((item) => ({ value: item, label: item }))]}
            className="w-[210px]"
            aria-label="Région"
          />
          <Select
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "Toutes catégories" },
              ...CATEGORIES.map((item) => ({ value: String(item), label: item === "Palace" ? "Palace" : `${item}★` })),
            ]}
            className="w-[160px]"
            aria-label="Catégorie"
          />
        </div>
        <DialogBody className="p-0">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Search className="size-5 text-faint" />
              <p className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Aucun hôtel trouvé</p>
              <p className="text-[11.5px] text-muted">Élargissez la recherche ou changez de région.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {results.map((hotel) => {
                const added = state.basket.includes(hotel.id);
                return (
                  <li key={hotel.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-medium text-ink">{hotel.nom}</span>
                        <CategoryBadge categorie={hotel.categorie} />
                        {hotel.demo && (
                          <span className="rounded-[2px] border border-dashed border-accent/50 px-1 text-[8.5px] uppercase tracking-[0.08em] text-accent">
                            Compilé
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted">
                        {hotel.ville} ({hotel.codePostal}) · {hotel.groupe} · {fmtInt(hotel.cles)} clés
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={added ? "subtle" : "outline"}
                      disabled={added}
                      onClick={() => add(hotel.id, hotel.nom)}
                      className={cn("shrink-0", added && "text-green")}
                    >
                      {added ? "Ajouté" : <><Plus className="size-3" /> Ajouter</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="mr-auto text-[10.5px] text-faint">{results.length} hôtel(s) affiché(s)</span>
          <Button type="button" variant="primary" onClick={() => onOpenChange(false)}>
            Terminer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Petite aide de typage pour les sélecteurs de catégorie. */
export type CategoryValue = Categorie | "";
