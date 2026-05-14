import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DadosClienteEditaveis {
  nome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cpf?: string;
  documento?: string;
  data_nascimento?: string;
  cep?: string;
  rua?: string;
  numero_endereco?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
}

export function useAtualizarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { clienteId: string; dados: DadosClienteEditaveis }) => {
      const { data, error } = await supabase.rpc("atualizar_cliente" as any, {
        p_cliente_id: args.clienteId,
        p_dados: args.dados as any,
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error ?? "Erro ao salvar");
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente", vars.clienteId] });
      qc.invalidateQueries({ queryKey: ["cliente-completo", vars.clienteId] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["clientes-saldos"] });
      toast.success("Dados atualizados");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
