import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ConferenciaScanner, type ConferenciaScanResult } from "./ConferenciaScanner";
import { ConferenciaResumoDrawer, type ConferenciaResumo } from "./ConferenciaResumoDrawer";
import type { AparelhoAssistencia } from "@/hooks/useAparelhosAssistencia";

type Props = {
  aparelhos: AparelhoAssistencia[];
  /** Trigger custom — se omitido, renderiza um botão padrão */
  triggerLabel?: string;
};

const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido", em_analise: "Em análise", aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado", em_reparo: "Em reparo", aguardando_peca: "Aguardando peça", pronto: "Pronto",
};

export function ConferenciaAparelhosButton({ aparelhos, triggerLabel = "Conferir aparelhos" }: Props) {
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Esperados: aparelhos com IMEI em status ativo (todos os retornados, exceto entregue — já filtrado no hook)
  const esperados = useMemo(
    () => aparelhos.filter(a => a.aparelho_imei && a.aparelho_imei.length > 0),
    [aparelhos]
  );
  const esperadosMap = useMemo(() => {
    const m = new Map<string, AparelhoAssistencia>();
    esperados.forEach(a => m.set(a.aparelho_imei!.replace(/\D/g, ""), a));
    return m;
  }, [esperados]);

  // State da conferência (refeito a cada abertura)
  const [conferidos, setConferidos] = useState<Set<string>>(new Set());
  const [divergencias, setDivergencias] = useState<Map<string, { status: string; label: string }>>(new Map());
  const [foraDoSistema, setForaDoSistema] = useState<Set<string>>(new Set());

  const reset = () => {
    setConferidos(new Set());
    setDivergencias(new Map());
    setForaDoSistema(new Set());
  };

  const abrir = () => {
    if (esperados.length === 0) {
      toast.warning("Nenhum aparelho em assistência com IMEI cadastrado para conferir");
      return;
    }
    reset();
    setScannerOpen(true);
  };

  const handleScan = useCallback((raw: string): ConferenciaScanResult => {
    const code = raw.replace(/\D/g, "");
    const aparelho = esperadosMap.get(code);

    if (aparelho) {
      if (conferidos.has(code)) {
        return { status: "duplicate", label: "Já conferido", sublabel: aparelho.cliente_nome };
      }
      setConferidos(prev => new Set(prev).add(code));
      return {
        status: "ok",
        label: aparelho.cliente_nome,
        sublabel: `${aparelho.aparelho_marca} ${aparelho.aparelho_modelo} · ${STATUS_LABEL[aparelho.status] ?? aparelho.status}`,
      };
    }

    // Existe no banco em outro contexto? Busca async fire-and-forget pra alertar
    if (foraDoSistema.has(code) || divergencias.has(code)) {
      return { status: "duplicate", label: "Já registrado", sublabel: code };
    }

    // Marca como "fora do sistema" otimistamente; consulta async pode promover para divergência
    setForaDoSistema(prev => new Set(prev).add(code));
    (async () => {
      const { data } = await supabase
        .from("aparelhos")
        .select("imei, marca, modelo, clientes ( nome ), ordens_de_servico ( status, deleted_at )")
        .eq("imei", code)
        .maybeSingle();
      if (data) {
        const os: any = Array.isArray(data.ordens_de_servico) ? data.ordens_de_servico[0] : data.ordens_de_servico;
        const cliente: any = Array.isArray(data.clientes) ? data.clientes[0] : data.clientes;
        const statusOS = os?.status ?? "sem OS";
        setForaDoSistema(prev => { const n = new Set(prev); n.delete(code); return n; });
        setDivergencias(prev => {
          const n = new Map(prev);
          n.set(code, { status: statusOS, label: `${cliente?.nome ?? "?"} — ${data.marca} ${data.modelo}` });
          return n;
        });
        toast.warning(`IMEI cadastrado mas com status: ${STATUS_LABEL[statusOS] ?? statusOS}`);
      }
    })();

    return { status: "error", label: "IMEI não esperado", sublabel: code };
  }, [conferidos, divergencias, foraDoSistema, esperadosMap]);

  const counterText = `Conferidos: ${conferidos.size}/${esperados.length}`;
  const alertCount = divergencias.size + foraDoSistema.size;

  const buildResumo = (): ConferenciaResumo => {
    const conferidosArr = Array.from(conferidos).map(code => {
      const a = esperadosMap.get(code)!;
      return { codigo: code, titulo: `${a.cliente_nome} — ${a.aparelho_marca} ${a.aparelho_modelo}`, detalhe: STATUS_LABEL[a.status] ?? a.status };
    });
    const naoEncontrados = esperados
      .filter(a => !conferidos.has(a.aparelho_imei!.replace(/\D/g, "")))
      .map(a => ({ codigo: a.aparelho_imei!, titulo: `${a.cliente_nome} — ${a.aparelho_marca} ${a.aparelho_modelo}`, detalhe: `OS #${a.os_numero_formatado ?? a.os_numero} · ${STATUS_LABEL[a.status] ?? a.status}` }));
    const divergenciasArr = Array.from(divergencias.entries()).map(([codigo, info]) => ({
      codigo, titulo: info.label, detalhe: `Status no sistema: ${STATUS_LABEL[info.status] ?? info.status}`,
    }));
    const foraArr = Array.from(foraDoSistema).map(codigo => ({ codigo, titulo: "IMEI não cadastrado no sistema" }));
    return {
      tipo: "aparelhos",
      titulo: `Conferência de aparelhos — ${new Date().toLocaleDateString("pt-BR")}`,
      conferidos: conferidosArr,
      divergencias: divergenciasArr,
      naoEncontrados,
      foraDoSistema: foraArr,
    };
  };

  const [resumoData, setResumoData] = useState<ConferenciaResumo | null>(null);

  const finalizar = () => {
    setResumoData(buildResumo());
    setScannerOpen(false);
    setResumoOpen(true);
  };

  const salvar = async () => {
    if (!resumoData) return;
    setSalvando(true);
    try {
      const responsavel = user?.email?.split("@")[0] ?? "Operador";
      const { error } = await supabase.from("conferencias_estoque").insert({
        tipo: "aparelhos",
        responsavel,
        user_id: user?.id ?? null,
        status: "concluida" as any,
        tipo_conferencia: "aparelhos",
        data_inicio: new Date().toISOString(),
        data_fim: new Date().toISOString(),
        total_esperado: esperados.length,
        total_conferido: conferidos.size,
        total_divergencias: divergencias.size + foraDoSistema.size,
        detalhes: resumoData as any,
      } as any);
      if (error) throw error;
      toast.success("Conferência salva com sucesso");
      setResumoOpen(false);
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={abrir}>
        <Camera className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{triggerLabel}</span>
        <span className="sm:hidden">Conferir</span>
      </Button>

      <ConferenciaScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Conferência de aparelhos"
        counterText={counterText}
        alertCount={alertCount}
        onScanCode={handleScan}
        onFinalize={finalizar}
      />

      <ConferenciaResumoDrawer
        open={resumoOpen}
        onClose={() => setResumoOpen(false)}
        resumo={resumoData}
        onSalvar={salvar}
        salvando={salvando}
      />
    </>
  );
}
