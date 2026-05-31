import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePlanoAtual() {
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("empresa_plano")
      .select("plano_id")
      .eq("status", "ativo")
      .order("data_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlanoId((data as any)?.plano_id ?? null);
    setLoading(false);
  };

  useEffect(() => { recarregar(); }, []);
  return { planoId, loading, recarregar };
}
