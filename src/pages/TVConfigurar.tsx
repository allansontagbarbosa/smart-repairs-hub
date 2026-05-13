import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Tv, RefreshCw, Copy, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useTVPaineis,
  useCriarTVPainel,
  useRegenerarCodigoTV,
  useExcluirTVPainel,
} from "@/hooks/useTVPaineis";
import { toast } from "sonner";

const WIDGETS_DISPONIVEIS = [
  { id: "kpis_dia", icon: "📊", nome: "KPIs do dia", desc: "OSs entregues, faturamento, ticket médio" },
  { id: "podio_tecnicos", icon: "🏆", nome: "Pódio dos técnicos", desc: "Top 3 com OSs e comissão do mês" },
  { id: "meta_mes", icon: "🎯", nome: "Meta do mês", desc: "Barra de progresso vs meta" },
  { id: "aparelhos_tecnicos", icon: "📋", nome: "Aparelhos por técnico", desc: "Quantos cada um tem abertos" },
  { id: "alertas", icon: "⏰", nome: "Atenção necessária", desc: "OSs paradas, aguardando, peças" },
  { id: "financeiro_mes", icon: "💰", nome: "Financeiro mês", desc: "Receita, comissões, fluxo" },
  { id: "estoque_critico", icon: "📦", nome: "Estoque crítico", desc: "Peças abaixo do mínimo" },
  { id: "top_lojistas", icon: "🏪", nome: "Top lojistas", desc: "Top 5 que mais trazem OSs" },
  { id: "clima_relogio", icon: "🌡️", nome: "Clima + relógio", desc: "Hora atual, clima da cidade" },
];

const WIDGETS_PADRAO = [
  "kpis_dia",
  "podio_tecnicos",
  "meta_mes",
  "aparelhos_tecnicos",
  "alertas",
];

export default function TVConfigurar() {
  const { data: paineis = [], isLoading } = useTVPaineis();
  const criar = useCriarTVPainel();
  const regenerar = useRegenerarCodigoTV();
  const excluir = useExcluirTVPainel();
  const navigate = useNavigate();

  const [modoNovo, setModoNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [widgetsSelecionados, setWidgetsSelecionados] = useState<string[]>(WIDGETS_PADRAO);

  const toggleWidget = (id: string) =>
    setWidgetsSelecionados((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));

  const resetForm = () => {
    setModoNovo(false);
    setNome("");
    setTema("dark");
    setWidgetsSelecionados(WIDGETS_PADRAO);
  };

  const handleSalvar = async () => {
    if (!nome.trim()) return toast.error("Dê um nome ao painel");
    if (widgetsSelecionados.length === 0) return toast.error("Selecione pelo menos 1 widget");
    await criar.mutateAsync({ nome, widgets: widgetsSelecionados, tema });
    resetForm();
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast.success(`Código ${codigo} copiado!`);
  };

  const formatCodigo = (c: string) => `${c.slice(0, 3)}-${c.slice(3)}`;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tv className="h-6 w-6 text-primary" /> Painéis TV
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure dashboards pra mostrar em telas grandes na oficina
          </p>
        </div>
        {!modoNovo && (
          <Button onClick={() => setModoNovo(true)} className="bg-[#00C896] hover:bg-[#00b389] text-white">
            <Plus className="h-4 w-4 mr-2" /> Novo painel
          </Button>
        )}
      </div>

      {modoNovo && (
        <Card className="p-6 space-y-5">
          <h2 className="text-lg font-semibold">Criar novo painel</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do painel</label>
              <Input
                placeholder='Ex: "TV da bancada"'
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tema</label>
              <div className="grid grid-cols-2 gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTema(t)}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                      tema === t
                        ? "border-[#00C896] bg-[#00C896]/10 text-[#00C896]"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    {t === "dark" ? "🌙 Escuro" : "☀️ Claro"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Widgets ({widgetsSelecionados.length} selecionados)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {WIDGETS_DISPONIVEIS.map((w) => {
                const selected = widgetsSelecionados.includes(w.id);
                return (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className={`p-3 border-2 rounded-lg text-left relative transition-colors ${
                      selected ? "border-[#00C896] bg-[#00C896]/5" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#00C896] text-white text-xs flex items-center justify-center">
                        ✓
                      </span>
                    )}
                    <div className="text-2xl">{w.icon}</div>
                    <div className="font-semibold text-sm mt-1">{w.nome}</div>
                    <div className="text-xs text-muted-foreground">{w.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={criar.isPending} className="bg-[#00C896] hover:bg-[#00b389] text-white">
              {criar.isPending ? "Criando..." : "Criar painel"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && paineis.length === 0 && !modoNovo && (
          <p className="text-sm text-muted-foreground col-span-2">
            Nenhum painel ainda. Clique em "Novo painel" pra começar.
          </p>
        )}
        {paineis.map((p) => (
          <Card key={p.id} className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{p.nome}</h3>
                <p className="text-xs text-muted-foreground">{p.widgets.length} widgets</p>
              </div>
              <Badge variant="secondary">{p.tema === "dark" ? "🌙" : "☀️"} {p.tema}</Badge>
            </div>

            <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Código TV</p>
                <p className="font-mono text-2xl font-bold text-[#00C896] tracking-wider">
                  {formatCodigo(p.codigo)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => navigate(`/tv/editar/${p.id}`)} title="Editar layout">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => copiarCodigo(p.codigo)} title="Copiar código">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Regenerar código vai invalidar TVs conectadas. Continuar?"))
                      regenerar.mutate(p.id);
                  }}
                  title="Regenerar código"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover este painel? TVs conectadas serão desconectadas."))
                      excluir.mutate(p.id);
                  }}
                  title="Excluir painel"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{window.location.origin}/tv</span> → digite o código
            </p>

            {p.ultimo_acesso_em && (
              <p className="text-xs text-muted-foreground">
                Último acesso: {new Date(p.ultimo_acesso_em).toLocaleString("pt-BR")}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
