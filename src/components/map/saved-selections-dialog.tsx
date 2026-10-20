"use client";

import * as React from "react";
import { Bookmark, FolderOpen, Plus, Trash2 } from "lucide-react";
import type { Filters, SavedSelection } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function SavedSelectionsDialog({
  open,
  onOpenChange,
  filters,
  hotelIds,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  hotelIds: string[];
  onApply: (selection: SavedSelection) => void;
}) {
  const { state, saveSelection, deleteSelection } = useStore();
  const { toast } = useToast();
  const [creating, setCreating] = React.useState(false);
  const [nom, setNom] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [partage, setPartage] = React.useState(true);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCreating(false);
      setNom("");
      setDescription("");
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!nom.trim()) {
      toast({ title: "Nommez la sélection", tone: "error" });
      return;
    }
    saveSelection({
      nom: nom.trim(),
      description: description.trim(),
      filters,
      hotelIds,
      partage,
    });
    toast({
      title: "Sélection enregistrée",
      description: `${hotelIds.length} hôtels · critères réutilisables`,
      tone: "success",
    });
    setCreating(false);
    setNom("");
    setDescription("");
  };

  const remove = (selection: SavedSelection) => {
    if (!window.confirm(`Supprimer la sélection « ${selection.nom} » ?`)) return;
    deleteSelection(selection.id);
    toast({ title: "Sélection supprimée", tone: "info" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent wide>
        <DialogHeader
          title="Sélections enregistrées"
          description="Retrouvez un périmètre de recherche, partagez-le ou recréez le même cadrage."
        />
        <DialogBody className="min-h-[280px]">
          {creating ? (
            <div className="mx-auto max-w-lg space-y-3">
              <Field label="Nom de la sélection" required>
                <Input
                  value={nom}
                  onChange={(event) => setNom(event.target.value)}
                  placeholder="Ex. 4★ spa — Courbevoie 15 km"
                  autoFocus
                />
              </Field>
              <Field label="Description" hint="Facultatif">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contexte de la mission, usage prévu…"
                  rows={3}
                />
              </Field>
              <div className="rounded-[3px] border border-line bg-paper/70 px-3 py-2.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-soft">Hôtels dans le périmètre</span>
                  <span className="font-semibold tabular text-ink">{hotelIds.length}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-soft">Exercice de référence</span>
                  <span className="tabular text-ink">{filters.annee}</span>
                </div>
                <div className="mt-2 border-t border-line pt-2">
                  <Checkbox
                    checked={partage}
                    onChange={setPartage}
                    label="Partager avec les membres de l'équipe"
                  />
                </div>
              </div>
            </div>
          ) : state.savedSelections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bookmark className="mb-3 size-5 text-faint" />
              <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">Aucune sélection enregistrée</p>
              <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted">
                Enregistrez vos filtres pour réouvrir un cadrage en un clic ou le partager
                avec un associé.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {state.savedSelections.map((selection) => (
                <div
                  key={selection.id}
                  className="flex flex-col rounded-[3px] border border-line bg-surface p-3 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium leading-snug text-ink">
                        {selection.nom}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-muted">
                        {selection.description || "Sans description"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(selection)}
                      className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger"
                      aria-label={`Supprimer ${selection.nom}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.06em] text-faint">
                    <span className="tabular">{selection.hotelIds.length} hôtels</span>
                    <span>·</span>
                    <span>{selection.auteur}</span>
                    <span>·</span>
                    <span>{fmtDate(selection.createdAt)}</span>
                    {selection.partage && (
                      <span className="ml-auto rounded-[2px] border border-line px-1 py-[1px] normal-case tracking-normal text-muted">
                        Partagée
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full text-[11px]"
                    onClick={() => {
                      onApply(selection);
                      onOpenChange(false);
                      toast({
                        title: "Sélection appliquée",
                        description: selection.nom,
                        tone: "success",
                      });
                    }}
                  >
                    <FolderOpen className="size-3.5" />
                    Ouvrir cette sélection
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {creating ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Retour
              </Button>
              <Button variant="primary" size="sm" onClick={submit}>
                <Bookmark className="size-3.5" />
                Enregistrer la sélection
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-3.5" />
                Enregistrer les filtres actuels
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
