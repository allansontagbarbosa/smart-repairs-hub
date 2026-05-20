import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Vars {
  servicoId: string;
  tecnicoId: string | null;
  nomeAlvo: string;
}

export function useAtualizarTecnicoServico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, tecnicoId }: Vars) => {
      const update: Record<string, any> = {
        tecnico_id: tecnicoId,
        motivo_sem_tecnico: tecnicoId === null ? "sem_atribuicao" : null,
        updated_at: new Date().toISOString(),
      };
      if (tecnicoId !== null) {
        update.iniciado_em = new Date().toISOString();
      }
      const { error } = await supabase
        .from("os_servicos")
        .update(update)
        .eq("id", servicoId);
      if (error) throw error;
      return { servicoId, tecnicoId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tecnicos"] });
      queryClient.invalidateQueries({ queryKey: ["os-servicos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success(
        vars.tecnicoId === null
          ? 'Serviço movido pra "Sem técnico"'
          : `Atribuído a ${vars.nomeAlvo}`,
      );
    },
    onError: (err: any) => {
      toast.error("Erro ao atribuir técnico: " + (err?.message || "desconhecido"));
    },
  });
}

export async function atribuirTodaOSAoTecnico(
  ordemId: string,
  tecnicoId: string | null,
) {
  const update: Record<string, any> = {
    tecnico_id: tecnicoId,
    motivo_sem_tecnico: tecnicoId === null ? "sem_atribuicao" : null,
    updated_at: new Date().toISOString(),
  };
  if (tecnicoId !== null) update.iniciado_em = new Date().toISOString();
  const { error } = await supabase
    .from("os_servicos")
    .update(update)
    .eq("ordem_id", ordemId);
  if (error) throw error;
}
