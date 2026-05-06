import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NovoRecebimentoAvulso {
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  forma_pagamento: string;
  observacoes?: string;
}

async function resolveEmpresaId(): Promise<string | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) return undefined;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("empresa_id")
    .or(`user_id.eq.${uid},id.eq.${uid}`)
    .eq("ativo", true)
    .maybeSingle();

  if (profile?.empresa_id) return profile.empresa_id;

  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  return emp?.id ?? undefined;
}

export function useCriarRecebimentoAvulso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoRecebimentoAvulso) => {
      const empresaId = await resolveEmpresaId();
      if (!empresaId) throw new Error("Empresa não identificada. Faça login novamente.");

      const dataIso = new Date(input.data + "T12:00:00").toISOString();

      const { error } = await (supabase as any)
        .from("movimentacoes_financeiras")
        .insert({
          tipo: "entrada",
          categoria: "recebimento_avulso",
          descricao: input.descricao.trim(),
          valor: input.valor,
          data: dataIso,
          forma_pagamento: input.forma_pagamento,
          empresa_id: empresaId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Recebimento registrado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao registrar recebimento.");
    },
  });
}
