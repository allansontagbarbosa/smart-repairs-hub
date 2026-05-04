import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { statusLabels, type Status } from "@/lib/status";
import { formatNumeroOS } from "@/lib/numeroOS";

interface PropostaIndividual {
  tipo: "individual";
  os_id: string;
  os_numero: number;
  os_numero_formatado?: string | null;
  status_atual: string;
  status_novo: string;
}

interface AmostraOS {
  id: string;
  numero: number;
  numero_formatado?: string | null;
  cliente: string;
  status: string;
  valor: number;
}

interface PropostaMassa {
  tipo: "massa";
  acao: "marcar_paga" | "atribuir_tecnico" | "mudar_status";
  qtd: number;
  ids: string[];
  amostra: AmostraOS[];
  excede_limite: boolean;
}

export type PropostaIA = PropostaIndividual | PropostaMassa;

interface Props {
  proposta: PropostaIA;
  conversaId: string;
  onConcluido?: () => void;
}

const labelStatus = (s: string) => statusLabels[s as Status] ?? s;

export function CardPropostaIA({ proposta, conversaId, onConcluido }: Props) {
  const [executando, setExecutando] = useState(false);
  const [executada, setExecutada] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  const { isAdmin } = usePermissoes();

  const logAcao = async (
    status: "executada" | "rejeitada",
    resultado: any = null,
    erroMsg?: string,
  ) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const tool =
        proposta.tipo === "individual"
          ? "executar_mudar_status"
          : `executar_${proposta.acao}_massa`;
      const ids =
        proposta.tipo === "individual" ? [proposta.os_id] : proposta.ids;

      // empresa_id via RPC pra respeitar isolamento
      const { data: empresaId } = await supabase.rpc("get_my_empresa_id" as any);

      await supabase.from("ia_acoes_log").insert({
        empresa_id: empresaId as any,
        usuario_id: userId,
        conversa_id: conversaId,
        tool_chamada: tool,
        argumentos: proposta as any,
        resultado,
        ids_afetados: ids,
        aprovado_por: status === "executada" ? userId : null,
        status,
        erro_mensagem: erroMsg ?? null,
      });
    } catch (e) {
      console.error("Falha ao logar ação IA:", e);
    }
  };

  if (executada) {
    return (
      <div className="mt-2 rounded-lg border border-[#00C896]/40 bg-[#00C896]/10 p-3 flex items-center gap-2 text-sm text-foreground">
        <CheckCircle2 className="h-4 w-4 text-[#00C896]" />
        Ação executada com sucesso.
      </div>
    );
  }

  if (cancelada) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Proposta cancelada.
      </div>
    );
  }

  // ─── INDIVIDUAL ──────────────────────────────────────────
  if (proposta.tipo === "individual") {
    const executar = async () => {
      setExecutando(true);
      const updates: Record<string, any> = { status: proposta.status_novo };
      if (proposta.status_novo === "pronto")
        updates.data_conclusao = new Date().toISOString();
      if (proposta.status_novo === "entregue")
        updates.data_entrega = new Date().toISOString();

      const { error } = await supabase
        .from("ordens_de_servico")
        .update(updates)
        .eq("id", proposta.os_id);

      setExecutando(false);
      if (error) {
        toast.error(error.message);
        await logAcao("rejeitada", null, error.message);
        return;
      }
      setExecutada(true);
      await logAcao("executada", { ok: true });
      toast.success(
        `OS #${formatNumeroOS(proposta.os_numero, proposta.os_numero_formatado)} atualizada`,
      );
      onConcluido?.();
    };

    return (
      <div className="mt-2 rounded-lg border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Proposta de mudança de status
        </div>
        <p className="text-sm text-foreground">
          OS{" "}
          <span className="font-mono">
            #{formatNumeroOS(proposta.os_numero, proposta.os_numero_formatado)}
          </span>
          : <span className="font-medium">{labelStatus(proposta.status_atual)}</span>{" "}
          → <span className="font-medium">{labelStatus(proposta.status_novo)}</span>
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={executar}
            disabled={executando}
            className="bg-[#00C896] hover:bg-[#00C896]/90 text-white"
          >
            {executando ? "Aplicando..." : "Aprovar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await logAcao("rejeitada");
              setCancelada(true);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ─── MASSA ────────────────────────────────────────────────
  const executarMassa = async () => {
    if (!isAdmin) {
      toast.error("Apenas admin pode executar ações em massa");
      return;
    }
    if (confirmacaoTexto !== "CONFIRMAR") {
      toast.error('Digite "CONFIRMAR" exatamente');
      return;
    }
    if (proposta.excede_limite) {
      toast.error("Excede limite de 200 registros");
      return;
    }

    setExecutando(true);
    let result: any = null;
    let error: any = null;

    if (proposta.acao === "marcar_paga") {
      const r = await supabase.rpc("marcar_os_pagas_em_massa" as any, {
        p_os_ids: proposta.ids,
      });
      result = r.data;
      error = r.error;
    } else {
      setExecutando(false);
      toast.error(
        `Ação "${proposta.acao}" em massa via chat ainda não suportada — use a barra de seleção na listagem.`,
      );
      return;
    }

    setExecutando(false);
    const ok = !error && (result as any)?.success !== false;
    if (!ok) {
      const msg = error?.message ?? (result as any)?.error ?? "Erro ao executar";
      toast.error(msg);
      await logAcao("rejeitada", result, msg);
      return;
    }

    setExecutada(true);
    await logAcao("executada", result);
    const n = (result as any)?.atualizadas ?? proposta.qtd;
    toast.success(`${n} OS atualizadas`);
    onConcluido?.();
  };

  return (
    <div className="mt-2 rounded-lg border-2 border-destructive/60 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <ShieldAlert className="h-4 w-4" />
        Ação em massa: {proposta.qtd} OS ({proposta.acao})
      </div>

      {proposta.excede_limite && (
        <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          ⚠️ Excede limite de 200 registros. Restrinja o filtro.
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          Amostra (primeiras {proposta.amostra.length})
        </p>
        <ul className="text-xs text-foreground space-y-0.5 max-h-32 overflow-y-auto">
          {proposta.amostra.map((a) => (
            <li key={a.id} className="truncate">
              • <span className="font-mono">#{formatNumeroOS(a.numero, a.numero_formatado)}</span>{" "}
              — {a.cliente} — {labelStatus(a.status)} — R${" "}
              {Number(a.valor ?? 0).toFixed(2)}
            </li>
          ))}
        </ul>
      </div>

      {!isAdmin && (
        <div className="rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          🔒 Apenas admin pode aprovar ações em massa.
        </div>
      )}

      {isAdmin && !proposta.excede_limite && (
        <>
          <Input
            value={confirmacaoTexto}
            onChange={(e) => setConfirmacaoTexto(e.target.value)}
            placeholder='Digite "CONFIRMAR" para liberar'
            className="text-xs h-8"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={executarMassa}
              disabled={executando || confirmacaoTexto !== "CONFIRMAR"}
            >
              {executando ? "Aplicando..." : `Executar ${proposta.acao}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await logAcao("rejeitada");
                setCancelada(true);
              }}
            >
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
