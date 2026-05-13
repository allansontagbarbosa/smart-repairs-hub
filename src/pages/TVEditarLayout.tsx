import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Eye, Upload, Trash2 } from "lucide-react";
import {
  useTVPaineis,
  useAtualizarLayoutTV,
  useUploadLogoTV,
} from "@/hooks/useTVPaineis";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const WIDGETS_META: Record<string, { icon: string; nome: string }> = {
  kpis_dia: { icon: "📊", nome: "KPIs do dia" },
  podio_tecnicos: { icon: "🏆", nome: "Pódio dos técnicos" },
  meta_mes: { icon: "🎯", nome: "Meta do mês" },
  aparelhos_tecnicos: { icon: "📋", nome: "Aparelhos por técnico" },
  alertas: { icon: "⏰", nome: "Atenção necessária" },
  financeiro_mes: { icon: "💰", nome: "Financeiro mês" },
  estoque_critico: { icon: "📦", nome: "Estoque crítico" },
  top_lojistas: { icon: "🏪", nome: "Top lojistas" },
  clima_relogio: { icon: "🌡️", nome: "Clima + relógio" },
};

export default function TVEditarLayout() {
  const { painelId } = useParams<{ painelId: string }>();
  const navigate = useNavigate();
  const { data: paineis = [] } = useTVPaineis();
  const { empresaId } = useEmpresa();
  const atualizar = useAtualizarLayoutTV();
  const uploadLogo = useUploadLogoTV();

  const painel = paineis.find((p) => p.id === painelId);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [tamanhoFonte, setTamanhoFonte] = useState<"P" | "M" | "G">("M");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (painel) {
      // garantir que todos os widgets têm posição
      const existentes = (painel.layout || []) as Layout[];
      const ids = new Set(existentes.map((l) => l.i));
      const faltando = (painel.widgets || []).filter((w) => !ids.has(w));
      const novos: Layout[] = faltando.map((w, i) => ({
        i: w,
        x: ((existentes.length + i) % 3) * 4,
        y: Math.floor((existentes.length + i) / 3) * 2,
        w: 4,
        h: 2,
        minW: 2,
        minH: 1,
      }));
      setLayout([...existentes, ...novos]);
      setTamanhoFonte(painel.tamanho_fonte || "M");
      setLogoUrl(painel.logo_url || null);
    }
  }, [painel]);

  if (!painel) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-muted-foreground">Carregando painel...</p>
      </div>
    );
  }

  const handleSalvar = async () => {
    await atualizar.mutateAsync({
      painel_id: painel.id,
      layout,
      tamanho_fonte: tamanhoFonte,
      logo_url: logoUrl || undefined,
    });
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    if (!empresaId) {
      toast.error("Empresa não identificada");
      return;
    }
    try {
      const url = await uploadLogo.mutateAsync({ empresa_id: empresaId, file });
      setLogoUrl(url);
      toast.success("Logo enviado");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/tv/configurar")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">Editar layout — {painel.nome}</h1>
            <p className="text-xs text-muted-foreground">
              Arraste e redimensione widgets. Código:{" "}
              <span className="font-mono font-bold">{painel.codigo}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/tv/d/${painel.codigo}`, "_blank")}
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={atualizar.isPending}
            className="bg-[#00C896] hover:bg-[#00b389] text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {atualizar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Configurações */}
      <Card className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Tamanho de fonte</label>
            <div className="flex gap-2">
              {(["P", "M", "G"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTamanhoFonte(t)}
                  className={`flex-1 py-2 border-2 rounded-lg font-bold text-sm transition-colors ${
                    tamanhoFonte === t
                      ? "border-[#00C896] bg-[#00C896]/10 text-[#00C896]"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  {t === "P" ? "Pequeno" : t === "M" ? "Médio" : "Grande"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium block">
              Logo da empresa (aparece no header da TV)
            </label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-12 w-12 object-contain bg-muted rounded p-1"
                  />
                  <Button variant="outline" size="sm" onClick={() => setLogoUrl(null)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </>
              ) : (
                <>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadLogo}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    disabled={uploadLogo.isPending}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadLogo.isPending ? "Enviando..." : "Enviar logo"}
                  </Button>
                  <span className="text-xs text-muted-foreground">PNG/JPG até 2MB</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Editor visual */}
      <Card className="p-4 bg-[#0a0a0a] border-white/10">
        <p className="text-xs text-white/60 mb-3">
          🎨 Arraste widgets para mover • Redimensione pelos cantos
        </p>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
          rowHeight={70}
          onLayoutChange={(l) => setLayout(l)}
          isDraggable
          isResizable
          margin={[12, 12]}
        >
          {layout.map((item) => {
            const meta = WIDGETS_META[item.i] || { icon: "📦", nome: item.i };
            return (
              <div
                key={item.i}
                className="bg-[#131313] border-2 border-[#00C896]/30 rounded-lg p-3 flex flex-col justify-between cursor-move overflow-hidden"
              >
                <div className="text-white text-sm font-semibold">
                  {meta.icon} {meta.nome}
                </div>
                <div className="text-[10px] text-white/50 text-right font-mono">
                  {item.w} col × {item.h} lin
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 Dica: O layout que você vê aqui é o que vai aparecer na TV. Clica em
        "Preview" pra abrir em outra aba e ver com os dados reais.
      </p>
    </div>
  );
}
