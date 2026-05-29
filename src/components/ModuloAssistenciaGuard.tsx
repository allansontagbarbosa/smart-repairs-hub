import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useModulos } from "@/hooks/useModulos";
import { Loader2 } from "lucide-react";

export function ModuloAssistenciaGuard({ children }: { children: ReactNode }) {
  const { isLoading, lojaAtivo, assistenciaAtivo } = useModulos();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistenciaAtivo && lojaAtivo) return <Navigate to="/loja/dashboard" replace />;
  return <>{children}</>;
}
