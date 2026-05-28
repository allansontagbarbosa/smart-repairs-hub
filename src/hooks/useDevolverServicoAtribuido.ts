import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useDevolverServicoAtribuido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from("os_servicos")
        .update({
          tecnico_id: null,
          motivo_sem_tecnico: "devolvido_pelo_tecnico",
          updated_at: new Date().toISOString(),
        })
        .eq("id", servicoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço devolvido. Voltou pro 'Sem técnico'.");
      qc.invalidateQueries({ queryKey: ["meus-servicos-atribuidos"] });
      qc.invalidateQueries({ queryKey: ["servicos-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["kanban-tecnicos"] });
      qc.invalidateQueries({ queryKey: ["os-servicos"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao devolver: " + (err?.message || "desconhecido"));
    },
  });
}
