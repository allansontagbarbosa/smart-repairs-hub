import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  /** Lista de perfis_acesso.nome_perfil que PODEM acessar a rota.
   *  Se omitido, qualquer perfil autenticado pode. */
  perfis?: string[];
  children: React.ReactNode;
}

export function PerfilGuard({ perfis, children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [perfilNome, setPerfilNome] = useState<string | null>(null);
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecando(false);
      return;
    }

    let cancelled = false;
    setChecando(true);

    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("perfis_acesso(nome_perfil)")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (cancelled) return;

      const pa = (data as any)?.perfis_acesso;
      const nome = Array.isArray(pa) ? pa[0]?.nome_perfil : pa?.nome_perfil;
      setPerfilNome(nome ?? null);
      setChecando(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || checando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (perfis) {
    // Se exige perfil específico mas usuário não tem perfil → bloqueia
    if (!perfilNome) {
      return <Navigate to="/sem-acesso" replace />;
    }
    // Tem perfil mas não está na lista permitida → redireciona pra home dele
    if (!perfis.includes(perfilNome)) {
      if (perfilNome === "Técnico") return <Navigate to="/tecnico" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
