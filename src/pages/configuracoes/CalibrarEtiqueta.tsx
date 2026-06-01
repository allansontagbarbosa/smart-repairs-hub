import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  useEtiquetaCalibracao,
  alinhamentoToFlex,
  type Calibracao,
} from "@/hooks/useEtiquetaCalibracao";
import { printEtiquetaOS } from "@/lib/printEtiqueta";

const ALINHAMENTOS = [
  ["tl", "tc", "tr"],
  ["ml", "mc", "mr"],
  ["bl", "bc", "br"],
];

const PX_PER_MM = 3;

export default function CalibrarEtiqueta() {
  const navigate = useNavigate();
  const { cal, loading, salvar, PADRAO } = useEtiquetaCalibracao();
  const [draft, setDraft] = useState<Calibracao>(cal);
  const [salvando, setSalvando] = useState(false);

  // Sync quando carregar
  if (!loading && draft === cal && JSON.stringify(draft) !== JSON.stringify(cal)) {
    setDraft(cal);
  }

  // garante que ao carregar pela 1a vez sincronize
  useState(() => {
    setDraft(cal);
    return cal;
  });

  const update = (patch: Partial<Calibracao>) => setDraft((d) => ({ ...d, ...patch }));
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const handleSalvar = async () => {
    setSalvando(true);
    const ok = await salvar(draft);
    setSalvando(false);
    toast({
      title: ok ? "Calibração salva" : "Erro ao salvar",
      description: ok ? "Aplicada a todas as etiquetas." : "Tente novamente.",
      variant: ok ? "default" : "destructive",
    });
  };

  const handleZerar = () => setDraft(PADRAO);

  const handleImprimirTeste = () => {
    printEtiquetaOS(
      {
        numero: 1234,
        numero_formatado: "01234/2026",
        clienteNome: "Cliente Teste",
        clienteTelefone: "",
        marca: "Apple",
        modelo: "iPhone 13",
        capacidade: "128GB",
        defeitos: "Teste de calibração",
        dataEntrada: new Date().toISOString(),
        previsaoEntrega: new Date(Date.now() + 3 * 86400000).toISOString(),
        imei: "350000000000001",
      },
      draft,
    );
  };

  const al = alinhamentoToFlex(draft.alinhamento);
  const previewW = draft.largura_mm * PX_PER_MM;
  const previewH = draft.altura_mm * PX_PER_MM;

  return (
    <div className="container max-w-5xl py-6 space-y-6" style={{ fontFamily: "Manrope, sans-serif" }}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Calibrar etiqueta</h1>
          <p className="text-sm text-muted-foreground">
            Ajuste o posicionamento da impressão. Vale para todas as etiquetas da empresa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ajustes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Offset X */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Offset horizontal</Label>
                <span className="text-sm font-mono">{draft.offset_x_mm.toFixed(1)} mm</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => update({ offset_x_mm: clamp(draft.offset_x_mm - 0.5, -10, 10) })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Slider
                  value={[draft.offset_x_mm]}
                  min={-10}
                  max={10}
                  step={0.5}
                  onValueChange={([v]) => update({ offset_x_mm: v })}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => update({ offset_x_mm: clamp(draft.offset_x_mm + 0.5, -10, 10) })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">− esquerda / + direita</p>
            </div>

            {/* Offset Y */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Offset vertical</Label>
                <span className="text-sm font-mono">{draft.offset_y_mm.toFixed(1)} mm</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => update({ offset_y_mm: clamp(draft.offset_y_mm - 0.5, -10, 10) })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Slider
                  value={[draft.offset_y_mm]}
                  min={-10}
                  max={10}
                  step={0.5}
                  onValueChange={([v]) => update({ offset_y_mm: v })}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => update({ offset_y_mm: clamp(draft.offset_y_mm + 0.5, -10, 10) })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">− cima / + baixo</p>
            </div>

            {/* Margem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Margem interna</Label>
                <span className="text-sm font-mono">{draft.margem_mm.toFixed(1)} mm</span>
              </div>
              <Slider
                value={[draft.margem_mm]}
                min={0}
                max={8}
                step={0.5}
                onValueChange={([v]) => update({ margem_mm: v })}
              />
            </div>

            {/* Alinhamento */}
            <div className="space-y-2">
              <Label>Alinhamento</Label>
              <div className="inline-grid grid-cols-3 gap-1 p-1 border rounded-md bg-muted/30">
                {ALINHAMENTOS.flat().map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ alinhamento: a })}
                    className={`h-10 w-10 rounded flex items-center justify-center transition-colors ${
                      draft.alinhamento === a
                        ? "bg-[#00C896] text-white"
                        : "bg-background hover:bg-muted"
                    }`}
                    title={a}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={handleSalvar} disabled={salvando} style={{ backgroundColor: "#00C896" }}>
                <Save className="h-4 w-4 mr-2" />
                {salvando ? "Salvando..." : "Salvar calibração"}
              </Button>
              <Button variant="outline" onClick={handleImprimirTeste}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir teste
              </Button>
              <Button variant="ghost" onClick={handleZerar}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Zerar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prévia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prévia ao vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-6 bg-muted/30 rounded-md">
              <div
                className="bg-white text-black border-2 border-dashed border-muted-foreground/50 relative"
                style={{ width: `${previewW}px`, height: `${previewH}px` }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    padding: `${draft.margem_mm * PX_PER_MM}px`,
                    transform: `translate(${draft.offset_x_mm * PX_PER_MM}px, ${draft.offset_y_mm * PX_PER_MM}px)`,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    gap: "2px",
                    fontFamily: "'Arial Narrow', Arial, sans-serif",
                    ...al,
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: "bold" }}>OS #01234/2026</div>
                  <div style={{ fontSize: "9px", fontWeight: 600 }}>Cliente Teste</div>
                  <div style={{ fontSize: "8px" }}>Apple iPhone 13 128GB</div>
                  <div style={{ fontSize: "7px", color: "#333" }}>IMEI: 350000000000001</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Etiqueta {draft.largura_mm}×{draft.altura_mm}mm (escala 1mm = {PX_PER_MM}px)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
