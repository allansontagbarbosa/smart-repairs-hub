import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ContaBancaria {
  id: string;
  nome: string;
  tipo: "corrente" | "poupanca" | "caixa" | "maquininha" | "outro";
  instituicao: string | null;
  cor: string | null;
  ativa: boolean;
  ordem: number;
  saldo_inicial: number;
  saldo: number;
}

export interface ContaMovimentacao {
  id: string;
  tipo: "entrada" | "saida" | "transferencia" | "ajuste";
  valor: number;
  descricao: string | null;
  data: string;
  origem: string | null;
  saldo_apos: number;
}

const showError = (msg: string) => toast({ title: "Erro", description: msg, variant: "destructive" });
const showOk = (msg: string) => toast({ title: msg });

function asRpcResult(data: any): { success: boolean; error?: string; data?: any; [k: string]: any } {
  return (data ?? {}) as any;
}

export function useContasBancarias(incluirInativas = false) {
  return useQuery({
    queryKey: ["contas-bancarias", incluirInativas],
    queryFn: async (): Promise<ContaBancaria[]> => {
      const { data, error } = await supabase.rpc("contas_bancarias_listar" as any, {
        p_incluir_inativas: incluirInativas,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha ao listar contas");
      return (res.data || []).map((c: any) => ({
        ...c,
        saldo_inicial: Number(c.saldo_inicial),
        saldo: Number(c.saldo),
      }));
    },
  });
}

export function useContaExtrato(contaId: string | null) {
  return useQuery({
    queryKey: ["conta-extrato", contaId],
    enabled: !!contaId,
    queryFn: async (): Promise<ContaMovimentacao[]> => {
      const { data, error } = await supabase.rpc("conta_extrato" as any, {
        p_conta_id: contaId,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha ao buscar extrato");
      return (res.data || []).map((m: any) => ({
        ...m,
        valor: Number(m.valor),
        saldo_apos: Number(m.saldo_apos),
      }));
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (contaId?: string | null) => {
    qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
    if (contaId) qc.invalidateQueries({ queryKey: ["conta-extrato", contaId] });
  };
}

export function useCriarConta() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { nome: string; tipo: string; instituicao?: string; cor?: string; saldo_inicial: number }) => {
      const { data, error } = await supabase.rpc("conta_bancaria_criar" as any, {
        p_nome: p.nome,
        p_tipo: p.tipo,
        p_instituicao: p.instituicao ?? null,
        p_cor: p.cor ?? null,
        p_saldo_inicial: p.saldo_inicial,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
      return res;
    },
    onSuccess: () => { invalidate(); showOk("Conta criada"); },
    onError: (e: any) => showError(e.message),
  });
}

export function useEditarConta() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { id: string; nome?: string; tipo?: string; instituicao?: string | null; cor?: string | null; ativa?: boolean }) => {
      const { data, error } = await supabase.rpc("conta_bancaria_editar" as any, {
        p_id: p.id,
        p_nome: p.nome ?? null,
        p_tipo: p.tipo ?? null,
        p_instituicao: p.instituicao ?? null,
        p_cor: p.cor ?? null,
        p_ativa: p.ativa ?? null,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
      return res;
    },
    onSuccess: () => { invalidate(); showOk("Conta atualizada"); },
    onError: (e: any) => showError(e.message),
  });
}

export function useArquivarConta() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("conta_bancaria_arquivar" as any, { p_id: id });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
    },
    onSuccess: () => { invalidate(); showOk("Conta arquivada"); },
    onError: (e: any) => showError(e.message),
  });
}

export function useLancarMovimentacao() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { conta_id: string; tipo: "entrada" | "saida"; valor: number; descricao?: string; data?: string }) => {
      const { data, error } = await supabase.rpc("conta_lancar_movimentacao" as any, {
        p_conta_id: p.conta_id,
        p_tipo: p.tipo,
        p_valor: p.valor,
        p_descricao: p.descricao ?? null,
        p_data: p.data ?? null,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
      return p.conta_id;
    },
    onSuccess: (contaId) => { invalidate(contaId); showOk("Movimentação lançada"); },
    onError: (e: any) => showError(e.message),
  });
}

export function useTransferir() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { origem_id: string; destino_id: string; valor: number; descricao?: string; data?: string }) => {
      const { data, error } = await supabase.rpc("conta_transferir" as any, {
        p_origem_id: p.origem_id,
        p_destino_id: p.destino_id,
        p_valor: p.valor,
        p_descricao: p.descricao ?? null,
        p_data: p.data ?? null,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
      return p;
    },
    onSuccess: (p) => {
      invalidate(p.origem_id);
      invalidate(p.destino_id);
      showOk("Transferência realizada");
    },
    onError: (e: any) => showError(e.message),
  });
}

export function useAjustarSaldo() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { conta_id: string; novo_saldo: number; motivo?: string }) => {
      const { data, error } = await supabase.rpc("conta_ajustar_saldo" as any, {
        p_conta_id: p.conta_id,
        p_novo_saldo: p.novo_saldo,
        p_motivo: p.motivo ?? null,
      });
      if (error) throw error;
      const res = asRpcResult(data);
      if (!res.success) throw new Error(res.error || "Falha");
      return p.conta_id;
    },
    onSuccess: (contaId) => { invalidate(contaId); showOk("Saldo ajustado"); },
    onError: (e: any) => showError(e.message),
  });
}

export const TIPO_CONTA_LABEL: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  caixa: "Dinheiro / Caixa",
  maquininha: "Maquininha",
  outro: "Outro",
};
