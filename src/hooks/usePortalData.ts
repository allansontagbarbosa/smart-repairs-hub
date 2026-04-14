import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PortalOrdem = {
  id: string;
  numero: number;
  status: string;
  defeito_relatado: string;
  valor: number | null;
  valor_pago: number | null;
  valor_pendente: number | null;
  custo_pecas: number | null;
  data_entrada: string;
  previsao_entrega: string | null;
  data_entrega: string | null;
  data_conclusao: string | null;
  observacoes: string | null;
  tecnico: string | null;
  prioridade: string;
  aparelhos: {
    marca: string;
    modelo: string;
    cor: string | null;
    cliente_id: string;
  } | null;
  lojas: {
    id: string;
    nome: string;
  } | null;
};

export type PortalLoja = {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
};

export function usePortalCliente() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portal-cliente", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Find cliente by email
      const email = user!.email;
      if (!email) return null;

      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, documento")
        .eq("email", email)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function usePortalLojas(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["portal-lojas", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, endereco, telefone")
        .eq("cliente_id", clienteId!)
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return (data ?? []) as PortalLoja[];
    },
  });
}

export function usePortalOrdens(clienteId: string | undefined, lojaFilter?: string) {
  return useQuery({
    queryKey: ["portal-ordens", clienteId, lojaFilter],
    enabled: !!clienteId,
    queryFn: async () => {
      // Get all aparelhos for this client
      const { data: aparelhos } = await supabase
        .from("aparelhos")
        .select("id")
        .eq("cliente_id", clienteId!);

      if (!aparelhos?.length) return [];

      const aparelhoIds = aparelhos.map((a) => a.id);

      let query = supabase
        .from("ordens_de_servico")
        .select(`id, numero, status, defeito_relatado, valor, valor_pago, valor_pendente, custo_pecas, data_entrada, previsao_entrega, data_entrega, data_conclusao, observacoes, tecnico, prioridade, aparelhos ( marca, modelo, cor, cliente_id ), lojas ( id, nome )`)
        .in("aparelho_id", aparelhoIds)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });

      if (lojaFilter && lojaFilter !== "todas") {
        query = query.eq("loja_id", lojaFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PortalOrdem[];
    },
  });
}

export function usePortalHistorico(ordemId: string | undefined) {
  return useQuery({
    queryKey: ["portal-historico", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_ordens")
        .select("id, status_novo, status_anterior, observacao, descricao, created_at")
        .eq("ordem_id", ordemId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
