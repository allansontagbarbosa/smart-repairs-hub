import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

export type TecnicoIdentidade = {
  user_id: string;
  funcionario_id: string | null;
  empresa_id: string | null;
  nome: string;
  cargo: string | null;
};

/** Identidade do técnico logado (funcionario vinculado ao user_profile). */
export function useTecnicoIdentidade() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tecnico-identidade", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TecnicoIdentidade | null> => {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("user_id, id, empresa_id, nome_exibicao, funcionario_id")
        .or(buildUserProfileLookup(user!.id))
        .eq("ativo", true)
        .maybeSingle();

      if (error || !profile) return null;

      let cargo: string | null = null;
      let nome = profile.nome_exibicao || user!.email || "Técnico";

      if (profile.funcionario_id) {
        const { data: func } = await supabase
          .from("funcionarios")
          .select("nome, cargo")
          .eq("id", profile.funcionario_id)
          .maybeSingle();
        if (func) {
          nome = func.nome || nome;
          cargo = func.cargo;
        }
      }

      return {
        user_id: user!.id,
        funcionario_id: profile.funcionario_id,
        empresa_id: profile.empresa_id,
        nome,
        cargo,
      };
    },
  });
}

export type MinhaOS = {
  id: string;
  numero: number;
  numero_formatado: string | null;
  status: string;
  defeito_relatado: string | null;
  data_entrada: string;
  previsao_entrega: string | null;
  data_conclusao: string | null;
  prioridade: string | null;
  valor: number | null;
  tipo_servico: string | null;
  aparelhos: { marca: string; modelo: string; cor: string | null } | null;
  clientes: { nome: string; telefone: string | null } | null;
};

export function useMinhasOS(funcionarioId: string | null | undefined) {
  return useQuery({
    queryKey: ["tecnico-minhas-os", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async (): Promise<MinhaOS[]> => {
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select(
          `id, numero, numero_formatado, status, defeito_relatado, data_entrada,
           previsao_entrega, data_conclusao, prioridade, valor, tipo_servico,
           aparelhos ( marca, modelo, cor, clientes ( nome, telefone ) )`
        )
        .eq("funcionario_id", funcionarioId!)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        clientes: row.aparelhos?.clientes ?? null,
        aparelhos: row.aparelhos
          ? { marca: row.aparelhos.marca, modelo: row.aparelhos.modelo, cor: row.aparelhos.cor }
          : null,
      }));
    },
  });
}

export type TecnicoMetricas = {
  os_concluidas: number;
  valor_servicos: number;
  os_em_aberto: number;
};

export function useTecnicoMetricas(funcionarioId: string | null | undefined, ano: number, mes: number) {
  return useQuery({
    queryKey: ["tecnico-metricas", funcionarioId, ano, mes],
    enabled: !!funcionarioId,
    queryFn: async (): Promise<TecnicoMetricas> => {
      const inicio = new Date(ano, mes - 1, 1).toISOString();
      const fim = new Date(ano, mes, 1).toISOString();

      const { data: concluidas } = await supabase
        .from("ordens_de_servico")
        .select("id, valor")
        .eq("funcionario_id", funcionarioId!)
        .in("status", ["pronto", "entregue"])
        .gte("data_conclusao", inicio)
        .lt("data_conclusao", fim);

      const { count: aberto } = await supabase
        .from("ordens_de_servico")
        .select("id", { count: "exact", head: true })
        .eq("funcionario_id", funcionarioId!)
        .not("status", "in", "(entregue,cancelado)")
        .is("deleted_at", null);

      return {
        os_concluidas: concluidas?.length ?? 0,
        valor_servicos: (concluidas ?? []).reduce((s, o: any) => s + Number(o.valor || 0), 0),
        os_em_aberto: aberto ?? 0,
      };
    },
  });
}
