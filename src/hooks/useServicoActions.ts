import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function assertRpcSuccess(data: any, fallback: string) {
  if (!data?.success) throw new Error(data?.error || fallback);
  return data;
}

export function useIniciarServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (osServicoId: string) => {
      const { data, error } = await supabase.rpc("iniciar_servico_os", {
        p_os_servico_id: osServicoId,
      });
      if (error) throw error;
      return assertRpcSuccess(data, "Erro ao iniciar serviço");
    },
    onSuccess: () => {
      toast.success("Serviço iniciado");
      qc.invalidateQueries({ queryKey: ["servicos-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["meus-servicos-em-andamento"] });
      qc.invalidateQueries({ queryKey: ["meus-servicos-atribuidos"] });
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
      qc.invalidateQueries({ queryKey: ["tecnico-os"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConcluirServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (osServicoId: string) => {
      const { data, error } = await supabase.rpc("concluir_servico_os", {
        p_os_servico_id: osServicoId,
      });
      if (error) throw error;
      return assertRpcSuccess(data, "Erro ao concluir serviço");
    },
    onSuccess: () => {
      toast.success("Serviço concluído. Comissão gerada.");
      qc.invalidateQueries({ queryKey: ["meus-servicos-em-andamento"] });
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
      qc.invalidateQueries({ queryKey: ["tecnico-metricas"] });
      qc.invalidateQueries({ queryKey: ["tecnico-os"] });
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSoltarServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (osServicoId: string) => {
      const { data, error } = await supabase.rpc("soltar_servico_os", {
        p_os_servico_id: osServicoId,
      });
      if (error) throw error;
      return assertRpcSuccess(data, "Erro ao soltar serviço");
    },
    onSuccess: () => {
      toast.success("Serviço devolvido para a fila");
      qc.invalidateQueries({ queryKey: ["servicos-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["meus-servicos-em-andamento"] });
      qc.invalidateQueries({ queryKey: ["meus-servicos-atribuidos"] });
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
      qc.invalidateQueries({ queryKey: ["tecnico-os"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
