import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConviteResult {
  success: boolean;
  token?: string;
  expira_em?: string;
  cliente_nome?: string;
  cliente_email?: string;
  error?: string;
}

export type StatusConvite = "pendente" | "aceito" | "revogado" | "expirado" | null;

export interface ClienteConviteRow {
  id: string;
  user_id: string | null;
  convite_token: string | null;
  convite_enviado_em: string | null;
  convite_aceito_em: string | null;
  convite_expira_em: string | null;
  status_convite: StatusConvite;
}

export function useClienteConvite(clienteId: string | undefined) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["cliente-convite", clienteId],
    queryFn: async (): Promise<ClienteConviteRow | null> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, user_id, convite_token, convite_enviado_em, convite_aceito_em, convite_expira_em, status_convite")
        .eq("id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data as ClienteConviteRow | null;
    },
  });
}

export function useCriarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clienteId: string): Promise<ConviteResult> => {
      const { data, error } = await supabase.rpc("criar_convite_cliente" as any, {
        p_cliente_id: clienteId,
      });
      if (error) throw error;
      const r = data as ConviteResult;
      if (!r.success) throw new Error(r.error ?? "Erro ao criar convite");
      return r;
    },
    onSuccess: (_, clienteId) => {
      qc.invalidateQueries({ queryKey: ["cliente-convite", clienteId] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Convite gerado");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

export function useRevogarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clienteId: string) => {
      const { data, error } = await supabase.rpc("revogar_convite_cliente" as any, {
        p_cliente_id: clienteId,
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error ?? "Erro ao revogar");
      return data;
    },
    onSuccess: (_, clienteId) => {
      qc.invalidateQueries({ queryKey: ["cliente-convite", clienteId] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Acesso revogado");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
