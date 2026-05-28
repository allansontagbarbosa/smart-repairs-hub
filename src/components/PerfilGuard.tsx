import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Loader2 } from "lucide-react";

interface Props {
  /** Lista de perfis_acesso.nome_perfil que PODEM acessar a rota.
   *  Se omitido, qualquer perfil autenticado pode. */
  perfis?: string[];
  children: React.ReactNode;
}

export function PerfilGuard({ perfis, children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { perfil, loading: permLoading } = usePermissoes();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (perfis && perfil) {
    // "sem_perfil" pode indicar timeout/lock do Supabase — NÃO bloquear.
    // ProtectedRoute (permissão CRUD) + RLS do banco continuam protegendo.
    if (perfil === "sem_perfil") {
      console.warn("[PerfilGuard] perfil indeterminado, liberando — guard de permissão + RLS protegem");
      return <>{children}</>;
    }
    if (!perfis.includes(perfil)) {
      if (perfil === "Técnico") return <Navigate to="/tecnico" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
