import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useModulos } from "@/hooks/useModulos";

export function ModuloComboGuard({ children }: { children: ReactNode }) {
  const { isLoading, combo } = useModulos();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!combo) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
