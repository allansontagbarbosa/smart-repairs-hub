import { useEffect, useMemo, useState } from "react";
import {
  useEtiquetaTemplates,
  useSaveEtiquetaTemplate,
  useDeleteEtiquetaTemplate,
  type EtiquetaTemplate,
} from "@/hooks/useEtiquetaTemplates";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy, Loader2, Star, ArrowUp, ArrowDown, Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CAMPOS_CATALOGO, DADOS_EXEMPLO, type CampoConfig } from "@/lib/etiquetas/campos";
import { renderEtiquetaBloco, imprimirEtiquetas } from "@/services/etiquetaRenderer";

const TIPOS = [
  { value: "os_entrada", label: "OS - Entrada", color: "bg-blue-100 text-blue-700" },
  { value: "os_retirada", label: "OS - Retirada", color: "bg-green-100 text-green-700" },
  { value: "peca_estoque", label: "Peça em Estoque", color: "bg-purple-100 text-purple-700" },
  { value: "cliente_aparelho", label: "Aparelho do Cliente", color: "bg-orange-100 text-orange-700" },
  { value: "custom", label: "Customizado", color: "bg-gray-100 text-gray-700" },
];

const PRESETS = [
  { label: "50×30 térmica", largura_mm: 50, altura_mm: 30, tipo_impressora: "termica" as const },
  { label: "80×50 térmica", largura_mm: 80, altura_mm: 50, tipo_impressora: "termica" as const },
  { label: "62×100 térmica", largura_mm: 62, altura_mm: 100, tipo_impressora: "termica" as const },
  { label: "10 por A4 (2×5)", largura_mm: 90, altura_mm: 50, tipo_impressora: "a4_multipla" as const, etiquetas_por_linha: 2, etiquetas_por_coluna: 5 },
  { label: "21 por A4 (3×7)", largura_mm: 63.5, altura_mm: 38.1, tipo_impressora: "a4_multipla" as const, etiquetas_por_linha: 3, etiquetas_por_coluna: 7 },
];

const TEMPLATE_BASE = (empresa_id: string): Partial<EtiquetaTemplate> => ({
  empresa_id,
  nome: "Novo Template",
  tipo: "os_entrada",
  largura_mm: 50,
  altura_mm: 30,
  margem_topo_mm: 2,
  margem_lateral_mm: 2,
  orientacao: "retrato",
  tipo_impressora: "termica",
  etiquetas_por_linha: 1,
  etiquetas_por_coluna: 1,
  espacamento_horizontal_mm: 2,
  espacamento_vertical_mm: 2,
  fonte_familia: "Arial",
  fonte_tamanho_base: 10,
  fonte_tamanho_titulo: 12,
  fonte_tamanho_pequeno: 8,
  campos_visiveis: ["nome_empresa", "os_numero", "cliente_nome", "aparelho", "data_entrada"],
  campos_config: [],
  mostrar_qr_code: false,
  qr_code_conteudo: "os_numero",
  qr_code_tamanho_mm: 15,
  qr_code_posicao: "direita",
  mostrar_codigo_barras: false,
  codigo_barras_conteudo: "os_numero",
  codigo_barras_altura_mm: 8,
  mostrar_logo: true,
  logo_posicao: "topo_centro",
  logo_altura_mm: 8,
  texto_rodape: null,
  mostrar_data_impressao: false,
  ativo: true,
  e_padrao: false,
});

export function ConfigEtiquetasTab() {
  const { empresa } = useEmpresa();
  const { data: templates = [], isLoading } = useEtiquetaTemplates();
  const saveMut = useSaveEtiquetaTemplate();
  const delMut = useDeleteEtiquetaTemplate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<EtiquetaTemplate> | null>(null);
  const [previewZoom, setPreviewZoom] = useState(150);

  // Selecionar primeiro template ao carregar
  useEffect(() => {
    if (!selectedId && templates.length > 0) {
      setSelectedId(templates[0].id);
      setDraft(templates[0]);
    }
  }, [templates, selectedId]);

  const selectedTemplate = templates.find((t) => t.id === selectedId);
  const isDirty = draft && selectedTemplate && JSON.stringify(draft) !== JSON.stringify(selectedTemplate);

  const upd = (partial: Partial<EtiquetaTemplate>) => setDraft((d) => ({ ...(d || {}), ...partial }));

  const onNovo = () => {
    if (!empresa?.id) return;
    const novo = TEMPLATE_BASE(empresa.id);
    setSelectedId(null);
    setDraft(novo);
  };

  const onDuplicar = () => {
    if (!selectedTemplate) return;
    const copy: any = { ...selectedTemplate, id: undefined, nome: `${selectedTemplate.nome} (cópia)`, e_padrao: false };
    setSelectedId(null);
    setDraft(copy);
  };

  const onSalvar = async () => {
    if (!draft) return;
    try {
      const saved = await saveMut.mutateAsync(draft);
      toast({ title: "Template salvo" });
      setSelectedId((saved as any).id);
      setDraft(saved as any);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const onExcluir = async () => {
    if (!selectedId) return;
    if (!confirm("Excluir este template?")) return;
    try {
      await delMut.mutateAsync(selectedId);
      setSelectedId(null);
      setDraft(null);
      toast({ title: "Template excluído" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const onDescartar = () => {
    if (selectedTemplate) setDraft(selectedTemplate);
  };

  const toggleCampo = (id: string) => {
    const visiveis = draft?.campos_visiveis || [];
    if (visiveis.includes(id)) {
      upd({
        campos_visiveis: visiveis.filter((v) => v !== id),
        campos_config: (draft?.campos_config || []).filter((c: CampoConfig) => c.id !== id),
      });
    } else {
      upd({
        campos_visiveis: [...visiveis, id],
        campos_config: [
          ...(draft?.campos_config || []),
          { id, mostrar_label: true, tamanho: "normal", alinhamento: "esquerda", negrito: false } as CampoConfig,
        ],
      });
    }
  };

  const moveCampo = (idx: number, dir: -1 | 1) => {
    const visiveis = [...(draft?.campos_visiveis || [])];
    const target = idx + dir;
    if (target < 0 || target >= visiveis.length) return;
    [visiveis[idx], visiveis[target]] = [visiveis[target], visiveis[idx]];
    upd({ campos_visiveis: visiveis });
  };

  const updCampoConfig = (id: string, partial: Partial<CampoConfig>) => {
    const list = [...(draft?.campos_config || [])] as CampoConfig[];
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) list.push({ id, mostrar_label: true, tamanho: "normal", alinhamento: "esquerda", ...partial });
    else list[idx] = { ...list[idx], ...partial };
    upd({ campos_config: list });
  };

  const getCampoConfig = (id: string): CampoConfig =>
    ((draft?.campos_config || []) as CampoConfig[]).find((c) => c.id === id) ||
    { id, mostrar_label: true, tamanho: "normal", alinhamento: "esquerda" };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <a
        href="/configuracoes/etiqueta"
        onClick={(e) => { e.preventDefault(); window.location.href = "/configuracoes/etiqueta"; }}
        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-[#00C896]/5 hover:bg-[#00C896]/10 transition"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-[#00C896]/15 flex items-center justify-center">
            <Printer className="h-4 w-4 text-[#00C896]" />
          </div>
          <div>
            <div className="text-sm font-medium">Calibrar etiqueta</div>
            <div className="text-xs text-muted-foreground">Ajuste offset, margem e alinhamento da impressão (Dymo 11352).</div>
          </div>
        </div>
        <span className="text-xs text-[#00C896] font-medium">Abrir →</span>
      </a>
    <div className="flex flex-col lg:flex-row gap-4 -mx-4 lg:mx-0">

      {/* LISTA */}
      <div className="lg:w-64 shrink-0 px-4 lg:px-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Templates</h3>
          <Button size="sm" variant="default" onClick={onNovo}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map((t) => {
            const tipo = TIPOS.find((x) => x.value === t.tipo);
            return (
              <Card
                key={t.id}
                onClick={() => { setSelectedId(t.id); setDraft(t); }}
                className={`p-3 cursor-pointer transition ${selectedId === t.id ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.nome}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Number(t.largura_mm)}×{Number(t.altura_mm)}mm · {t.tipo_impressora === "termica" ? "Térmica" : "A4"}</p>
                  </div>
                  {t.e_padrao && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                </div>
                <Badge variant="secondary" className={`mt-2 text-[9px] ${tipo?.color || ""}`}>{tipo?.label}</Badge>
              </Card>
            );
          })}
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum template ainda</p>
          )}
        </div>
      </div>

      {/* CONFIG + PREVIEW */}
      <div className="flex-1 min-w-0 px-4 lg:px-0">
        {!draft ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Selecione ou crie um template para editar
          </div>
        ) : (
          <>
            {/* Top actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">{draft.nome || "Sem nome"}</h3>
                {isDirty && <Badge variant="outline" className="text-[10px]">Alterações não salvas</Badge>}
              </div>
              <div className="flex gap-2">
                {isDirty && <Button size="sm" variant="ghost" onClick={onDescartar}>Descartar</Button>}
                {selectedTemplate && <Button size="sm" variant="outline" onClick={onDuplicar}><Copy className="h-3.5 w-3.5 mr-1" />Duplicar</Button>}
                {selectedTemplate && <Button size="sm" variant="outline" onClick={onExcluir}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>}
                <Button size="sm" onClick={onSalvar} disabled={saveMut.isPending}>
                  {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>

            <Tabs defaultValue="config">
              <TabsList>
                <TabsTrigger value="config">Configurar</TabsTrigger>
                <TabsTrigger value="preview">Prévia</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-6 mt-4">
                {/* Identificação */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Nome</Label><Input value={draft.nome || ""} onChange={(e) => upd({ nome: e.target.value })} /></div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={draft.tipo} onValueChange={(v: any) => upd({ tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><Switch checked={!!draft.e_padrao} onCheckedChange={(v) => upd({ e_padrao: v })} /><Label className="text-xs">Marcar como padrão para este tipo</Label></div>
                </section>

                {/* Tamanho */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tamanho</h4>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <Button key={p.label} size="sm" variant="outline" onClick={() => upd(p as any)}>{p.label}</Button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-4 gap-3">
                    <div><Label className="text-xs">Largura (mm)</Label><Input type="number" value={draft.largura_mm} onChange={(e) => upd({ largura_mm: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Altura (mm)</Label><Input type="number" value={draft.altura_mm} onChange={(e) => upd({ altura_mm: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Margem topo</Label><Input type="number" value={draft.margem_topo_mm} onChange={(e) => upd({ margem_topo_mm: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Margem lateral</Label><Input type="number" value={draft.margem_lateral_mm} onChange={(e) => upd({ margem_lateral_mm: Number(e.target.value) })} /></div>
                  </div>
                </section>

                {/* Impressora */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impressora</h4>
                  <Select value={draft.tipo_impressora} onValueChange={(v: any) => upd({ tipo_impressora: v })}>
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="termica">Térmica (1 etiqueta por página)</SelectItem>
                      <SelectItem value="a4_multipla">A4 com múltiplas etiquetas</SelectItem>
                    </SelectContent>
                  </Select>
                  {draft.tipo_impressora === "a4_multipla" && (
                    <div className="grid sm:grid-cols-4 gap-3">
                      <div><Label className="text-xs">Por linha</Label><Input type="number" min={1} max={10} value={draft.etiquetas_por_linha} onChange={(e) => upd({ etiquetas_por_linha: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Por coluna</Label><Input type="number" min={1} max={15} value={draft.etiquetas_por_coluna} onChange={(e) => upd({ etiquetas_por_coluna: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Espaço H (mm)</Label><Input type="number" value={draft.espacamento_horizontal_mm} onChange={(e) => upd({ espacamento_horizontal_mm: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Espaço V (mm)</Label><Input type="number" value={draft.espacamento_vertical_mm} onChange={(e) => upd({ espacamento_vertical_mm: Number(e.target.value) })} /></div>
                    </div>
                  )}
                </section>

                {/* Tipografia */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tipografia</h4>
                  <div className="grid sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Fonte</Label>
                      <Select value={draft.fonte_familia} onValueChange={(v) => upd({ fonte_familia: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Arial", "Helvetica", "Courier", "Verdana", "Times"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Base (pt)</Label><Input type="number" value={draft.fonte_tamanho_base} onChange={(e) => upd({ fonte_tamanho_base: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Título (pt)</Label><Input type="number" value={draft.fonte_tamanho_titulo} onChange={(e) => upd({ fonte_tamanho_titulo: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Pequeno (pt)</Label><Input type="number" value={draft.fonte_tamanho_pequeno} onChange={(e) => upd({ fonte_tamanho_pequeno: Number(e.target.value) })} /></div>
                  </div>
                </section>

                {/* Campos */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Campos visíveis</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {CAMPOS_CATALOGO.filter((c) => c.id !== "logo").map((c) => {
                      const ativo = (draft.campos_visiveis || []).includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-xs p-2 rounded border hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={ativo} onChange={() => toggleCampo(c.id)} />
                          <span className="flex-1">{c.label}</span>
                          <span className="text-[10px] text-muted-foreground">{c.exemplo}</span>
                        </label>
                      );
                    })}
                  </div>

                  {(draft.campos_visiveis || []).length > 0 && (
                    <div className="space-y-1.5 mt-4">
                      <p className="text-xs text-muted-foreground">Ordem e formatação (use ↑↓):</p>
                      {(draft.campos_visiveis || []).map((id, idx) => {
                        const meta = CAMPOS_CATALOGO.find((c) => c.id === id);
                        if (!meta) return null;
                        const cfg = getCampoConfig(id);
                        return (
                          <div key={id} className="flex flex-wrap items-center gap-2 p-2 rounded border bg-card text-xs">
                            <div className="flex gap-0.5">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveCampo(idx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveCampo(idx, 1)}><ArrowDown className="h-3 w-3" /></Button>
                            </div>
                            <span className="font-medium min-w-[100px]">{meta.label}</span>
                            <Input
                              placeholder="Label custom"
                              value={cfg.label_custom || ""}
                              onChange={(e) => updCampoConfig(id, { label_custom: e.target.value })}
                              className="h-7 w-32"
                            />
                            <label className="flex items-center gap-1"><Switch checked={cfg.mostrar_label !== false} onCheckedChange={(v) => updCampoConfig(id, { mostrar_label: v })} /> Label</label>
                            <label className="flex items-center gap-1"><Switch checked={!!cfg.negrito} onCheckedChange={(v) => updCampoConfig(id, { negrito: v })} /> Negrito</label>
                            <Select value={cfg.tamanho || "normal"} onValueChange={(v: any) => updCampoConfig(id, { tamanho: v })}>
                              <SelectTrigger className="h-7 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pequeno">Pequeno</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="grande">Grande</SelectItem>
                                <SelectItem value="titulo">Título</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={cfg.alinhamento || "esquerda"} onValueChange={(v: any) => updCampoConfig(id, { alinhamento: v })}>
                              <SelectTrigger className="h-7 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="esquerda">Esquerda</SelectItem>
                                <SelectItem value="centro">Centro</SelectItem>
                                <SelectItem value="direita">Direita</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Logo */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Logo</h4>
                  <div className="flex items-center gap-2"><Switch checked={!!draft.mostrar_logo} onCheckedChange={(v) => upd({ mostrar_logo: v })} /><Label className="text-xs">Mostrar logo da empresa</Label></div>
                  {draft.mostrar_logo && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Posição</Label>
                        <Select value={draft.logo_posicao} onValueChange={(v: any) => upd({ logo_posicao: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="topo_esquerda">Topo esquerda</SelectItem>
                            <SelectItem value="topo_centro">Topo centro</SelectItem>
                            <SelectItem value="topo_direita">Topo direita</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Altura (mm)</Label><Input type="number" value={draft.logo_altura_mm} onChange={(e) => upd({ logo_altura_mm: Number(e.target.value) })} /></div>
                    </div>
                  )}
                </section>

                {/* QR Code */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">QR Code</h4>
                  <div className="flex items-center gap-2"><Switch checked={!!draft.mostrar_qr_code} onCheckedChange={(v) => upd({ mostrar_qr_code: v })} /><Label className="text-xs">Mostrar QR Code</Label></div>
                  {draft.mostrar_qr_code && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Conteúdo</Label>
                        <Select value={draft.qr_code_conteudo} onValueChange={(v) => upd({ qr_code_conteudo: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="os_numero">Número da OS</SelectItem>
                            <SelectItem value="os_url">URL da OS</SelectItem>
                            <SelectItem value="imei">IMEI</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {draft.qr_code_conteudo === "os_url" && (
                        <div><Label className="text-xs">Base URL</Label><Input placeholder="https://ditt.com.br/os/" value={draft.qr_code_url_base || ""} onChange={(e) => upd({ qr_code_url_base: e.target.value })} /></div>
                      )}
                      <div><Label className="text-xs">Tamanho (mm)</Label><Input type="number" value={draft.qr_code_tamanho_mm} onChange={(e) => upd({ qr_code_tamanho_mm: Number(e.target.value) })} /></div>
                      <div>
                        <Label className="text-xs">Posição</Label>
                        <Select value={draft.qr_code_posicao} onValueChange={(v: any) => upd({ qr_code_posicao: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="esquerda">Esquerda</SelectItem>
                            <SelectItem value="direita">Direita</SelectItem>
                            <SelectItem value="centro_topo">Centro topo</SelectItem>
                            <SelectItem value="centro_baixo">Centro baixo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </section>

                {/* Código de barras */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Código de barras</h4>
                  <div className="flex items-center gap-2"><Switch checked={!!draft.mostrar_codigo_barras} onCheckedChange={(v) => upd({ mostrar_codigo_barras: v })} /><Label className="text-xs">Mostrar código de barras</Label></div>
                  {draft.mostrar_codigo_barras && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Conteúdo</Label>
                        <Select value={draft.codigo_barras_conteudo} onValueChange={(v) => upd({ codigo_barras_conteudo: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="os_numero">Número da OS</SelectItem>
                            <SelectItem value="sku">SKU</SelectItem>
                            <SelectItem value="imei">IMEI</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Altura (mm)</Label><Input type="number" value={draft.codigo_barras_altura_mm} onChange={(e) => upd({ codigo_barras_altura_mm: Number(e.target.value) })} /></div>
                    </div>
                  )}
                </section>

                {/* Rodapé */}
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rodapé</h4>
                  <Textarea
                    placeholder="Ex: Garantia 90 dias. Aparelho não retirado em 90 dias será descartado."
                    value={draft.texto_rodape || ""}
                    onChange={(e) => upd({ texto_rodape: e.target.value })}
                    className="text-xs"
                    rows={2}
                  />
                  <div className="flex items-center gap-2"><Switch checked={!!draft.mostrar_data_impressao} onCheckedChange={(v) => upd({ mostrar_data_impressao: v })} /><Label className="text-xs">Mostrar data de impressão</Label></div>
                </section>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <EtiquetaPreview template={draft as EtiquetaTemplate} zoom={previewZoom} logoUrl={empresa?.logo_url || null} onZoom={setPreviewZoom} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
    </div>
  );
}

function EtiquetaPreview({ template, zoom, logoUrl, onZoom }: { template: EtiquetaTemplate; zoom: number; logoUrl: string | null; onZoom: (z: number) => void }) {
  const [html, setHtml] = useState("");
  const dados = useMemo(() => ({ ...DADOS_EXEMPLO, logo_url: logoUrl }), [logoUrl]);

  useEffect(() => {
    let cancel = false;
    renderEtiquetaBloco(template, dados).then((h) => { if (!cancel) setHtml(h); });
    return () => { cancel = true; };
  }, [template, dados]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Zoom:</span>
        {[50, 75, 100, 150, 200].map((z) => (
          <Button key={z} size="sm" variant={zoom === z ? "default" : "outline"} onClick={() => onZoom(z)}>{z}%</Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => imprimirEtiquetas(template, dados)}>
          <Printer className="h-3.5 w-3.5 mr-1" />Imprimir prévia
        </Button>
      </div>
      <div className="border-2 border-dashed rounded-lg p-8 bg-muted/30 overflow-auto flex items-start justify-center min-h-[400px]">
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Tamanho real: {template.largura_mm}×{template.altura_mm}mm</p>
    </div>
  );
}
