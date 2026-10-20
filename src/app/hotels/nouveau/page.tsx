import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ManualHotelForm } from "@/components/import/manual-hotel-form";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";

export default function NewHotelPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Base hôtelière"
        title="Ajouter un hôtel"
        description="Créez une fiche manuellement avec sa source, sa date et son niveau de fiabilité. Les champs laissés vides restent vides : aucune donnée n’est extrapolée sans hypothèse explicite."
        actions={
          <Link href="/hotels" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-3.5" />
            Retour au répertoire
          </Link>
        }
      />
      <ManualHotelForm />
    </div>
  );
}
