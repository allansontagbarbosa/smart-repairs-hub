import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function base64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function useGerarBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { enviar_email?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke("gerar-backup-empresa", {
        body: { tipo: "manual", enviar_email: params.enviar_email ?? false },
      });
      if (error) throw error;
      if (!data?.sucesso) throw new Error(data?.erro || "Falha");

      if (!params.enviar_email && data.xlsx_base64) {
        const blob = base64ToBlob(
          data.xlsx_base64,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.nome_xlsx;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if (data.json_base64) {
          const jblob = base64ToBlob(data.json_base64, "application/json");
          const jurl = URL.createObjectURL(jblob);
          const ja = document.createElement("a");
          ja.href = jurl;
          ja.download = data.nome_json;
          ja.click();
          setTimeout(() => URL.revokeObjectURL(jurl), 1000);
        }
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.email_enviado) toast.success("Backup enviado por email");
      else toast.success(`Backup gerado — ${data.registros_total} registros`);
      qc.invalidateQueries({ queryKey: ["backup_historico"] });
      qc.invalidateQueries({ queryKey: ["empresa_config"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao gerar backup"),
  });
}

export function useImportarBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { backup_json: any; modo: "merge" | "replace"; confirmacao_nome_empresa: string }) => {
      const { data, error } = await supabase.functions.invoke("importar-backup-empresa", {
        body: params,
      });
      if (error) throw error;
      if (!data?.sucesso) throw new Error(data?.erro || "Falha");
      return data;
    },
    onSuccess: () => {
      toast.success("Backup restaurado");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao importar"),
  });
}

export function useBackupHistorico() {
  return useQuery({
    queryKey: ["backup_historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_historico")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useBackupConfig() {
  return useQuery({
    queryKey: ["empresa_config", "backup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_config")
        .select("empresa_id, email, backup_email_destino, backup_frequencia, backup_dia_semana, backup_hora, backup_ultimo_envio_em")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSalvarBackupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      backup_email_destino: string | null;
      backup_frequencia: string;
      backup_dia_semana: number | null;
      backup_hora: number;
    }) => {
      const { data: cfg } = await supabase.from("empresa_config").select("id").maybeSingle();
      if (!cfg) throw new Error("Configuração da empresa não encontrada");
      const { error } = await supabase.from("empresa_config").update(params).eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["empresa_config"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar"),
  });
}
