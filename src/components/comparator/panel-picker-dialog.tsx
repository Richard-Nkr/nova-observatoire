"use client";

import * as React from "react";
import { FolderOpen, Layers3 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";

/**
 * Recharge un panel enregistré (sélection de la carte ou benchmark existant).
 * Le comparateur ne modifie ni la sélection ni le benchmark : il copie leurs hôtels.
 */
export function PanelPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, setBasket, setReference } = useStore();
  const { toast } = useToast();

  const load = (hotelIds: string[], referenceId: string | null, label: string) => {
    setBasket(hotelIds);
    setReference(referenceId && hotelIds.includes(referenceId) ? referenceId : hotelIds[0] ?? null);
    toast({ title: "Panel chargé", description: `${label} — ${hotelIds.length} hôtels`, tone: "success" });
    onOpenChange(false);
  };

  const selections = state.savedSelections;
  const benchmarks = state.benchmarks;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader
          title="Charger un panel existant"
          description="Sélections enregistrées depuis la carte et benchmarks de mission. Les hôtels sont recopiés dans le panier de travail."
        />
        <DialogBody>
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <FolderOpen className="size-3.5 text-accent" />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Sélections de la carte
                </h3>
              </div>
              {selections.length === 0 ? (
                <p className="border border-dashed border-line px-3 py-4 text-[11.5px] text-faint">
                  Aucune sélection enregistrée. Créez-en une depuis la carte & recherche.
                </p>
              ) : (
                <ul className="divide-y divide-line/70 border border-line">
                  {selections.map((selection) => (
                    <li key={selection.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-ink">{selection.nom}</p>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted">
                          {selection.hotelIds.length} hôtels · {selection.auteur} · {fmtDate(selection.createdAt)}
                        </p>
                      </div>
                      {selection.partage && <Badge tone="green">Partagée</Badge>}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => load(selection.hotelIds, null, selection.nom)}
                      >
                        Charger
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Layers3 className="size-3.5 text-accent" />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Benchmarks de mission
                </h3>
              </div>
              {benchmarks.length === 0 ? (
                <p className="border border-dashed border-line px-3 py-4 text-[11.5px] text-faint">
                  Aucun benchmark enregistré.
                </p>
              ) : (
                <ul className="divide-y divide-line/70 border border-line">
                  {benchmarks.map((benchmark) => (
                    <li key={benchmark.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[12.5px] font-medium text-ink">{benchmark.nom}</p>
                          <Badge tone="neutral">v{benchmark.version}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted">
                          {benchmark.client} · {benchmark.hotelIds.length} hôtels · exercice {benchmark.annee}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => load(benchmark.hotelIds, benchmark.referenceId, benchmark.nom)}
                      >
                        Charger
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
