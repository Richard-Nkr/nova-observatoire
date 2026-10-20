"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const ROLES: Role[] = ["Lecteur", "Contributeur", "Admin"];

/** Invitation d'un utilisateur ; les initiales sont dérivées du nom. */
export function UserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addUser } = useStore();
  const { toast } = useToast();
  const [nom, setNom] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("Contributeur");
  const [accesConfidentiel, setAccesConfidentiel] = React.useState(false);

  const submit = () => {
    if (!nom.trim() || !email.trim()) {
      toast({ title: "Nom et e-mail requis.", tone: "error" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: "Adresse e-mail invalide.", tone: "error" });
      return;
    }
    addUser({
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      role,
      accesConfidentiel: role === "Admin" ? true : accesConfidentiel,
      actif: true,
    });
    toast({ title: "Utilisateur invité", description: `${nom.trim()} — ${role}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Inviter un utilisateur"
          description="Le compte est actif immédiatement dans cet environnement."
        />
        <DialogBody className="space-y-4">
          <Field label="Nom complet">
            <Input value={nom} onChange={(event) => setNom(event.target.value)} placeholder="Prénom Nom" />
          </Field>
          <Field label="Adresse e-mail">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom.nom@nova-conseil.fr"
            />
          </Field>
          <Field label="Rôle" hint="Le rôle Admin donne accès à l’administration et au journal d’audit.">
            <Select
              value={role}
              onChange={(value) => setRole(value as Role)}
              options={ROLES.map((item) => ({ value: item, label: item }))}
            />
          </Field>
          <Checkbox
            checked={role === "Admin" ? true : accesConfidentiel}
            onChange={setAccesConfidentiel}
            disabled={role === "Admin"}
            label={
              <span>
                Accès aux données clients confidentielles
                <span className="mt-0.5 block text-[10.5px] text-muted">
                  Transactions et missions marquées « confidentiel client ».
                </span>
              </span>
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit}>
            <UserPlus />
            Inviter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
