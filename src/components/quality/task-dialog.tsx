"use client";

import { useState } from "react";
import { Search, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { EXTRACTION_DATE } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { Hotel, Task } from "@/lib/types";

const PRIORITES: Task["priorite"][] = ["Haute", "Moyenne", "Basse"];
const DEFAULT_DUE = new Date(new Date(EXTRACTION_DATE).getTime() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

/** Création d'une tâche de complétion, éventuellement pré-affectée à un hôtel. */
export function TaskDialog({
  open,
  onOpenChange,
  initialHotelId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHotelId?: string;
}) {
  const { state, addTask, currentUser } = useStore();
  const { toast } = useToast();
  const initial = state.hotels.find((hotel) => hotel.id === initialHotelId) ?? null;

  const [hotel, setHotel] = useState<Hotel | null>(initial);
  const [query, setQuery] = useState("");
  const [champ, setChamp] = useState(initial ? "Actualiser les KPI" : "Compléter la fiche");
  const [priorite, setPriorite] = useState<Task["priorite"]>("Moyenne");
  const [assigneeId, setAssigneeId] = useState<string>(currentUser.id);
  const [echeance, setEcheance] = useState(DEFAULT_DUE);

  const results = state.hotels
    .filter((candidate) => {
      if (!query.trim()) return false;
      const haystack = `${candidate.nom} ${candidate.ville} ${candidate.codePostal}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .slice(0, 7);

  const activeUsers = state.users.filter((user) => user.actif);
  const assigneeOptions = [
    { value: "", label: "Non assignée" },
    ...activeUsers.map((user) => ({ value: user.id, label: `${user.nom} — ${user.role}` })),
  ];

  function submit() {
    if (!hotel) {
      toast({ title: "Sélectionnez un hôtel.", tone: "error" });
      return;
    }
    if (!champ.trim()) {
      toast({ title: "Précisez le champ à compléter.", tone: "error" });
      return;
    }
    if (!echeance) {
      toast({ title: "Renseignez une échéance.", tone: "error" });
      return;
    }
    addTask({
      hotelId: hotel.id,
      hotelNom: hotel.nom,
      champ: champ.trim(),
      region: hotel.region,
      assigneeId: assigneeId || null,
      priorite,
      statut: "À faire",
      echeance,
    });
    toast({ title: "Tâche créée", description: `${hotel.nom} — ${champ.trim()}`, tone: "success" });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title="Nouvelle tâche"
          description="Affectez la complétion d’une fiche ou d’un indicateur à un consultant."
        />
        <DialogBody className="space-y-4">
          <Field label="Hôtel" required>
            {hotel ? (
              <div className="flex items-start justify-between gap-3 rounded-[3px] border border-line bg-[#faf8f3] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-ink">{hotel.nom}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <CategoryBadge categorie={hotel.categorie} />
                    <span>
                      {hotel.ville} · {hotel.region}
                    </span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setHotel(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher un hôtel, une ville…"
                    className="pl-8"
                    autoFocus
                  />
                </div>
                {query.trim() && (
                  <div className="scroll-thin max-h-48 overflow-y-auto rounded-[3px] border border-line">
                    {results.length === 0 ? (
                      <p className="px-3 py-3 text-[12px] text-muted">Aucun hôtel trouvé.</p>
                    ) : (
                      results.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => {
                            setHotel(candidate);
                            setQuery("");
                          }}
                          className="flex w-full items-center justify-between gap-3 border-b border-line/70 px-3 py-2 text-left last:border-0 hover:bg-[#faf8f3]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium text-ink">
                              {candidate.nom}
                            </span>
                            <span className="block text-[10.5px] text-muted">
                              {candidate.ville} · {candidate.region}
                            </span>
                          </span>
                          <Badge tone="outline">{candidate.categorie === "Palace" ? "Palace" : `${candidate.categorie}★`}</Badge>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Champ ou action attendue" required>
            <Input
              value={champ}
              onChange={(event) => setChamp(event.target.value)}
              placeholder="Ex. Renseigner la surface F&B"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Priorité">
              <Select
                value={priorite}
                onChange={(value) => setPriorite(value as Task["priorite"])}
                options={PRIORITES.map((item) => ({ value: item, label: item }))}
              />
            </Field>
            <Field label="Échéance" required>
              <Input type="date" value={echeance} onChange={(event) => setEcheance(event.target.value)} />
            </Field>
          </div>

          <Field label="Assignée à">
            <Select value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} />
          </Field>

          <p className="flex items-start gap-2 rounded-[3px] border border-line bg-paper/60 px-3 py-2 text-[11px] leading-relaxed text-muted">
            <UserRound className="mt-0.5 size-3.5 shrink-0 text-faint" />
            La tâche apparaît dans la file de complétion et reste traçable dans le journal d’audit.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="accent" onClick={submit} className={cn(!hotel && "opacity-60")}>
            Créer la tâche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
