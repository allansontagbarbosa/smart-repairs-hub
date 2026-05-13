import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Responsive, WidthProvider, type LayoutItem } from "react-grid-layout/legacy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Eye, Upload, Trash2, Plus, X } from "lucide-react";
import {
  useTVPaineis,
  useAtualizarLayoutTV,
  useAtualizarTVPainel,
  useUploadLogoTV,
} from "@/hooks/useTVPaineis";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { getWidget, type WidgetMeta } from "@/lib/widgetsCatalogo";
import { WidgetSelectorDialog } from "@/components/tv/WidgetSelectorDialog";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function TVEditarLayout() {
  const { painelId } = useParams<{ painelId: string }>();
  const navigate = useNavigate();
  const { data: paineis = [] } = useTVPaineis();
  const { empresaId } = useEmpresa();
  const atualizarLayout = useAtualizarLayoutTV();
  const atualizarPainel = useAtualizarTVPainel();
  const uploadLogo = useUploadLogoTV();

  const painel = paineis.find((p) => p.id === painelId);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [tamanhoFonte, setTamanhoFonte] = useState<"P" | "M" | "G">("M");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectorAberto, setSelectorAberto] = useState(false);
  const [resizingInfo, setResizingInfo] = useState<{ id: string; w: number; h: number } | null>(null);

  useEffect(() => {
    if (painel) {
      const existentes = (painel.layout || []) as LayoutItem[];
      const ids = new Set(existentes.map((l) => l.i));
      const faltando = (painel.widgets || []).filter((w) => !ids.has(w));
      const novos: LayoutItem[] = faltando.map((w, i) => {
        const meta = getWidget(w);
        return {
          i: w,
          x: ((existentes.length + i) % 3) * 4,
          y: Math.floor((existentes.length + i) / 3) * 2,
          w: meta?.defaultW ?? 4,
          h: meta?.defaultH ?? 2,
          minW: meta?.minW ?? 2,
          minH: meta?.minH ?? 1,
        };
      });
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

  const widgetsAtivos = layout.map((l) => l.i);

  const handleAdicionarWidget = (w: WidgetMeta) => {
    if (widgetsAtivos.includes(w.id)) return;
    const maxY = layout.reduce((m, it) => Math.max(m, (it.y || 0) + (it.h || 1)), 0);
    setLayout([
      ...layout,
      {
        i: w.id,
        x: 0,
        y: maxY,
        w: w.defaultW,
        h: w.defaultH,
        minW: w.minW,
        minH: w.minH,
      },
    ]);
    toast.success(`${w.nome} adicionado`);
    setSelectorAberto(false);
  };

  const handleRemoverWidget = (id: string) => {
    setLayout(layout.filter((it) => it.i !== id));
    toast.success("Widget removido");
  };

  const handleSalvar = async () => {
    // Persiste a lista de widgets (derivada do layout) e o layout em si
    await atualizarPainel.mutateAsync({
      painel_id: painel.id,
      widgets: layout.map((l) => l.i),
    });
    await atualizarLayout.mutateAsync({
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

  const salvando = atualizarLayout.isPending || atualizarPainel.isPending;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/tv/configurar")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">Editar layout — {painel.nome}</h1>
            <p className="text-xs text-muted-foreground">
              {layout.length} widgets • Código:{" "}
              <span className="font-mono font-bold">{painel.codigo}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectorAberto(true)}
            className="border-[#00C896] text-[#00C896] hover:bg-[#00C896]/10"
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar widget
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/tv/d/${painel.codigo}`, "_blank")}
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-[#00C896] hover:bg-[#00b389] text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
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
            <label className="text-sm font-medium block">Logo da empresa</label>
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
          🎨 Arraste pra mover • Redimensione pelos cantos • Hover no widget e clica no ✕ pra remover
        </p>

        {layout.length === 0 ? (
          <div className="text-center py-16 text-white/60">
            <div className="text-5xl mb-3">📺</div>
            <p className="font-semibold mb-3">Sem widgets ainda</p>
            <Button
              onClick={() => setSelectorAberto(true)}
              className="bg-[#00C896] hover:bg-[#00b389] text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro widget
            </Button>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
            rowHeight={70}
            onLayoutChange={(l) => setLayout(l as LayoutItem[])}
            isDraggable
            isResizable
            margin={[12, 12]}
            draggableCancel=".no-drag"
          >
            {layout.map((item) => {
              const meta = getWidget(item.i);
              return (
                <div
                  key={item.i}
                  className="group relative bg-[#131313] border-2 border-[#00C896]/30 rounded-lg p-3 flex flex-col justify-between cursor-move overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoverWidget(item.i)}
                    className="no-drag absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition z-10"
                    title="Remover widget"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-white text-sm font-semibold pr-7">
                    {meta?.icon ?? "📦"} {meta?.nome ?? item.i}
                  </div>
                  <div className="text-[10px] text-white/50 text-right font-mono">
                    {item.w} col × {item.h} lin
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        )}
      </Card>

      <WidgetSelectorDialog
        open={selectorAberto}
        onClose={() => setSelectorAberto(false)}
        widgetsAtivos={widgetsAtivos}
        onAdd={handleAdicionarWidget}
      />
    </div>
  );
}
