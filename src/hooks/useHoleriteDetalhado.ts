import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HoleriteEventoRow = {
  id: string;
  tipo: "provento" | "desconto";
  codigo: string;
  descricao: string;
  referencia: string | null;
  valor_centavos: number;
  ordem: number;
  origem: string | null;
};

export type HoleriteDetalhadoData = {
  success: boolean;
  funcionario: {
    id: string;
    nome: string;
    cargo: string | null;
    tipo_vinculo: string | null;
    cpf: string | null;
    data_admissao: string | null;
  };
  competencia: string;
  eventos: HoleriteEventoRow[];
  total_proventos_centavos: number;
  total_descontos_centavos: number;
  liquido_centavos: number;
  horas_trabalhadas: number;
  dias_trabalhados: number;
  faltas: number;
};

const unwrap = (d: any) => (typeof d === "string" ? JSON.parse(d) : d);

export function useHoleriteDetalhado(funcionarioId: string | null, competencia: string) {
  return useQuery({
    queryKey: ["rh", "holerite-detalhado", funcionarioId, competencia],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("holerite_detalhado", {
        p_funcionario_id: funcionarioId!,
        p_competencia: competencia,
      });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r as HoleriteDetalhadoData;
    },
    staleTime: 0,
  });
}

export function useMontarHolerite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { funcionario_id: string; competencia: string }) => {
      const { data, error } = await (supabase as any).rpc("holerite_montar", {
        p_funcionario_id: vars.funcionario_id,
        p_competencia: vars.competencia,
      });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "holerite-detalhado"] });
      qc.invalidateQueries({ queryKey: ["rh", "holerite"] });
    },
  });
}

export function useEmpresaParaHolerite() {
  return useQuery({
    queryKey: ["rh", "empresa-holerite"],
    queryFn: async () => {
      const { data: emp, error } = await supabase
        .from("empresas")
        .select("nome, cnpj, telefone, email, rua, numero, bairro, cidade, estado")
        .maybeSingle();
      if (error) throw error;
      return {
        nome: emp?.nome,
        cnpj: emp?.cnpj,
        telefone: emp?.telefone,
        email: emp?.email,
        endereco: [emp?.rua, emp?.numero, emp?.bairro].filter(Boolean).join(", ") || null,
        cidade: emp?.cidade,
        estado: emp?.estado,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
