import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import PainelSocioPessoal from "./PainelSocioPessoal";
import PainelSocioAdmin from "./PainelSocioAdmin";
import { usePapelSocio } from "@/hooks/usePapelSocio";

/**
 * SOCIO-PERM-01 — Roteador de visão:
 *  - Sócio  → visão pessoal (preservada como antes)
 *  - ADM não-sócio → visão administrativa consolidada
 *  - Outros perfis nunca chegam aqui (SocioGuard bloqueia)
 */
export default function PainelSocio() {
  const { data, isLoading } = usePapelSocio();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <Navigate to="/sem-acesso" replace />;

  // Sócio (mesmo sendo ADM também) vê a visão pessoal — a "fatia dele" é informação dele.
  if (data.ehSocio) return <PainelSocioPessoal />;
  // ADM não-sócio → visão administrativa
  if (data.ehAdmin) return <PainelSocioAdmin />;

  return <Navigate to="/sem-acesso" replace />;
}
