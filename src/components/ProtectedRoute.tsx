import { Navigate } from "react-router-dom";
import { usePermissoes, type Permissoes } from "@/hooks/usePermissoes";

interface Props {
  permissao: string; // e.g. "financeiro.ver" or "dashboard"
  children: React.ReactNode;
}

export function ProtectedRoute({ permissao, children }: Props) {
  const { can, loading } = usePermissoes();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const parts = permissao.split(".");
  const modulo = parts[0] as keyof Permissoes;
  const acao = parts[1] as "ver" | "criar" | "editar" | "excluir" | undefined;

  if (!can(modulo, acao)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  return <>{children}</>;
}
