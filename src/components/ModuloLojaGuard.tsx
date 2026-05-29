import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useModulos } from "@/hooks/useModulos";
import { Loader2 } from "lucide-react";

export function ModuloLojaGuard({ children }: { children: ReactNode }) {
  const { isLoading, lojaAtivo } = useModulos();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lojaAtivo) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
