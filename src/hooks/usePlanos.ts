import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlanoComModulos {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  modulos: string[];
}

export function usePlanos() {
  const [planos, setPlanos] = useState<PlanoComModulos[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: ps } = await supabase
        .from("planos")
        .select("id, slug, nome, preco_mensal")
        .eq("ativo", true);
      const { data: pm } = await supabase
        .from("plano_modulos")
        .select("plano_id, modulo");
      const merged = (ps ?? []).map((p: any) => ({
        ...p,
        preco_mensal: Number(p.preco_mensal),
        modulos: (pm ?? [])
          .filter((m: any) => m.plano_id === p.id)
          .map((m: any) => m.modulo),
      }));
      setPlanos(merged as PlanoComModulos[]);
      setLoading(false);
    })();
  }, []);

  const planoPorModulos = (mods: string[]) => {
    if (!mods.length) return null;
    const key = [...mods].sort().join(",");
    return planos.find((p) => [...p.modulos].sort().join(",") === key) ?? null;
  };
  const planoPorSlugModulo = (mod: string) =>
    planos.find((p) => p.modulos.length === 1 && p.modulos[0] === mod) ?? null;

  return { planos, loading, planoPorModulos, planoPorSlugModulo };
}
