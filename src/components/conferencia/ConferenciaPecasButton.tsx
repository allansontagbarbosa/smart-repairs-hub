import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ConferenciaScanner, type ConferenciaScanResult } from "./ConferenciaScanner";
import { ConferenciaResumoDrawer, type ConferenciaResumo } from "./ConferenciaResumoDrawer";
import type { EstoqueItem } from "@/hooks/useEstoque";

type Props = { itens: EstoqueItem[] };

export function ConferenciaPecasButton({ itens }: Props) {
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resumoData, setResumoData] = useState<ConferenciaResumo | null>(null);

  // Esperados: itens com quantidade > 0 e algum identificador (codigo_barras, sku ou imei_serial)
  const esperados = useMemo(
    () => itens.filter(i => i.quantidade > 0 && (i.codigo_barras || i.sku || i.imei_serial)),
    [itens]
  );

  // Index por código (barras, sku ou imei) — todos lowercase
  const esperadosIdx = useMemo(() => {
    const m = new Map<string, EstoqueItem>();
    esperados.forEach(i => {
      [i.codigo_barras, i.sku, i.imei_serial].forEach(c => { if (c) m.set(c.toLowerCase().trim(), i); });
    });
    return m;
  }, [esperados]);

  const [contagem, setContagem] = useState<Map<string, number>>(new Map()); // item.id -> qtd
  const [foraDoSistema, setForaDoSistema] = useState<Map<string, number>>(new Map()); // codigo -> qtd

  const reset = () => { setContagem(new Map()); setForaDoSistema(new Map()); };

  const nomeItem = (i: EstoqueItem) =>
    i.nome_personalizado
    || [i.marcas?.nome, i.modelos?.nome, i.cor].filter(Boolean).join(" ")
    || i.estoque_categorias?.nome
    || "Item";

  const abrir = () => {
    if (esperados.length === 0) {
      toast.warning("Nenhuma peça com código de barras/SKU para conferir");
      return;
    }
    reset();
    setScannerOpen(true);
  };

  const handleScan = useCallback((raw: string): ConferenciaScanResult => {
    const code = raw.toLowerCase().trim();
    const item = esperadosIdx.get(code);

    if (item) {
      const novaQtd = (contagem.get(item.id) ?? 0) + 1;
      setContagem(prev => new Map(prev).set(item.id, novaQtd));
      const nome = nomeItem(item);
      const restante = item.quantidade - novaQtd;
      return {
        status: novaQtd > item.quantidade ? "warn" : "ok",
        label: `${nome}: ${novaQtd} un.`,
        sublabel: `Sistema: ${item.quantidade}${restante < 0 ? ` · ${Math.abs(restante)} acima` : ""}`,
      };
    }

    const novaQtd = (foraDoSistema.get(code) ?? 0) + 1;
    setForaDoSistema(prev => new Map(prev).set(code, novaQtd));
    return { status: "error", label: "Peça não cadastrada", sublabel: `${code} (${novaQtd}x)` };
  }, [contagem, foraDoSistema, esperadosIdx]);

  const itensUnicosContados = contagem.size;
  const totalUnidades = Array.from(contagem.values()).reduce((s, n) => s + n, 0)
    + Array.from(foraDoSistema.values()).reduce((s, n) => s + n, 0);
  const counterText = `Itens únicos: ${itensUnicosContados}/${esperados.length} | Unidades: ${totalUnidades}`;
  const alertCount = foraDoSistema.size + Array.from(contagem.entries()).filter(([id, qtd]) => {
    const it = esperados.find(e => e.id === id);
    return it && qtd !== it.quantidade;
  }).length;

  const buildResumo = (): ConferenciaResumo => {
    const conferidos: ConferenciaResumo["conferidos"] = [];
    const divergencias: ConferenciaResumo["divergencias"] = [];
    const naoEncontrados: ConferenciaResumo["naoEncontrados"] = [];

    esperados.forEach(item => {
      const qtd = contagem.get(item.id) ?? 0;
      const cod = item.codigo_barras || item.sku || item.imei_serial || item.id;
      const linha = { codigo: cod, titulo: nomeItem(item), detalhe: `Sistema: ${item.quantidade} · Contado: ${qtd} · Diferença: ${qtd - item.quantidade > 0 ? "+" : ""}${qtd - item.quantidade}` };
      if (qtd === 0) naoEncontrados.push(linha);
      else if (qtd === item.quantidade) conferidos.push(linha);
      else divergencias.push(linha);
    });

    const fora: ConferenciaResumo["foraDoSistema"] = Array.from(foraDoSistema.entries()).map(([codigo, qtd]) => ({
      codigo, titulo: "Código não cadastrado", detalhe: `${qtd} unidade(s) escaneada(s)`,
    }));

    return {
      tipo: "pecas",
      titulo: `Conferência de peças — ${new Date().toLocaleDateString("pt-BR")}`,
      conferidos, divergencias, naoEncontrados, foraDoSistema: fora,
    };
  };

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
        tipo: "pecas",
        responsavel,
        user_id: user?.id ?? null,
        status: "concluida" as any,
        tipo_conferencia: "pecas",
        data_inicio: new Date().toISOString(),
        data_fim: new Date().toISOString(),
        total_esperado: esperados.length,
        total_conferido: itensUnicosContados,
        total_divergencias: resumoData.divergencias.length + resumoData.naoEncontrados.length + resumoData.foraDoSistema.length,
        detalhes: resumoData as any,
      } as any);
      if (error) throw error;
      toast.success("Conferência salva");
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
        <span className="hidden sm:inline">Conferência de estoque</span>
        <span className="sm:hidden">Conferir</span>
      </Button>

      <ConferenciaScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Conferência de peças"
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
