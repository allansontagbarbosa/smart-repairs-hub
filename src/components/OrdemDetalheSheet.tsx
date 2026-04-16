import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, X, Check, ChevronRight, Phone, Smartphone, Clock, User, Plus, Trash2, Printer, Star, Copy, Share2, Shield, FileText } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import { printEtiquetaOS } from "@/lib/printEtiqueta";
import { cn } from "@/lib/utils";
import { formatNumeroOS, labelOS } from "@/lib/numeroOS";
import { ImpressaoOS, type ImpressaoOSData } from "@/components/ImpressaoOS";
import { useReactToPrint } from "react-to-print";




interface Props {
  orderId: string | null;
  onClose: () => void;
}

export function OrdemDetalheSheet({ orderId, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [selectedPecaId, setSelectedPecaId] = useState("");
  const [pecaQtd, setPecaQtd] = useState(1);
  const [editingDiag, setEditingDiag] = useState(false);
  const [diagValue, setDiagValue] = useState("");
  const [editingServico, setEditingServico] = useState(false);
  const [servicoValue, setServicoValue] = useState("");
  const queryClient = useQueryClient();
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["ordem", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select(`*, aparelhos ( *, clientes ( * ) )`)
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["historico", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("historico_ordens")
        .select("*")
        .eq("ordem_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: pecasUtilizadas = [] } = useQuery({
    queryKey: ["pecas_utilizadas", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("pecas_utilizadas")
        .select("*, estoque ( nome, categoria )")
        .eq("ordem_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: comissoesOS = [] } = useQuery({
    queryKey: ["comissoes_os", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("comissoes")
        .select("*, funcionarios ( nome )")
        .eq("ordem_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: avaliacao } = useQuery({
    queryKey: ["avaliacao_os", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from("avaliacoes")
        .select("id, nota, comentario, created_at")
        .eq("ordem_id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId,
  });

  const { data: garantia } = useQuery({
    queryKey: ["garantia_os", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from("garantias")
        .select("*")
        .eq("ordem_id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId,
  });

  // Fetch tipos_servico and funcionarios for commission preview
  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos_servico_os"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });
  const { data: funcionariosAtivos = [] } = useQuery({
    queryKey: ["funcionarios_os"],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("id, nome, tipo_comissao, valor_comissao").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  // Fetch per-service commission for commission preview
  const { data: comissaoPreview } = useQuery({
    queryKey: ["comissao_preview", ordem?.funcionario_id, ordem?.tipo_servico_id],
    queryFn: async () => {
      if (!ordem?.funcionario_id) return null;
      // Try per-service
      if (ordem.tipo_servico_id) {
        const { data } = await supabase
          .from("comissoes_servico")
          .select("tipo_comissao, valor")
          .eq("funcionario_id", ordem.funcionario_id)
          .eq("tipo_servico_id", ordem.tipo_servico_id)
          .maybeSingle();
        if (data && Number(data.valor) > 0) {
          const tipoLabel = data.tipo_comissao === "percentual" ? "%" : "R$";
          const valorCalc = data.tipo_comissao === "percentual"
            ? (ordem.valor ?? 0) * Number(data.valor) / 100
            : Number(data.valor);
          return { tipo: data.tipo_comissao, config: Number(data.valor), calculado: valorCalc, origem: "por serviço" };
        }
      }
      // Fallback to default
      const func = funcionariosAtivos.find(f => f.id === ordem.funcionario_id);
      if (func && Number(func.valor_comissao) > 0) {
        const valorCalc = func.tipo_comissao === "percentual"
          ? (ordem.valor ?? 0) * Number(func.valor_comissao) / 100
          : Number(func.valor_comissao);
        return { tipo: func.tipo_comissao, config: Number(func.valor_comissao), calculado: valorCalc, origem: "padrão" };
      }
      return null;
    },
    enabled: !!ordem?.funcionario_id && comissoesOS.length === 0,
  });

  const { data: despesasOS = [] } = useQuery({
    queryKey: ["despesas_os", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("contas_a_pagar")
        .select("id, descricao, valor, status, fornecedores ( nome )")
        .eq("ordem_servico_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: pecasDisponiveis = [] } = useQuery({
    queryKey: ["pecas_disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("id, nome, categoria, quantidade, preco_custo")
        .gt("quantidade", 0)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: empresaImpressao } = useQuery({
    queryKey: ["empresa_config_impressao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("nome, cnpj_cpf, telefone, email, endereco, cidade, estado, logo_url")
        .maybeSingle();
      return data;
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: ordem ? `OS-${formatNumeroOS((ordem as any).numero, (ordem as any).numero_formatado)}` : "OS",
  });

  const addPecaMutation = useMutation({
    mutationFn: async ({ pecaId, qtd }: { pecaId: string; qtd: number }) => {
      if (!ordem) return;
      const peca = pecasDisponiveis.find(p => p.id === pecaId);
      if (!peca) throw new Error("Peça não encontrada");
      if (peca.quantidade < qtd) throw new Error(`Estoque insuficiente (disponível: ${peca.quantidade})`);

      // Insert usage record
      const { error: e1 } = await supabase.from("pecas_utilizadas").insert({
        ordem_id: ordem.id,
        peca_id: pecaId,
        quantidade: qtd,
        custo_unitario: peca.preco_custo ?? 0,
      });
      if (e1) throw e1;

      // Deduct from stock
      const { error: e2 } = await supabase.from("estoque").update({
        quantidade: peca.quantidade - qtd,
      }).eq("id", pecaId);
      if (e2) throw e2;

      // Update OS custo_pecas
      const custoAdicional = (peca.preco_custo ?? 0) * qtd;
      const { error: e3 } = await supabase.from("ordens_de_servico").update({
        custo_pecas: (ordem.custo_pecas ?? 0) + custoAdicional,
      }).eq("id", ordem.id);
      if (e3) throw e3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pecas_utilizadas", orderId] });
      queryClient.invalidateQueries({ queryKey: ["pecas_disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["pecas"] });
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setAddingPart(false);
      setSelectedPecaId("");
      setPecaQtd(1);
      toast.success("Peça registrada e estoque atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removePecaMutation = useMutation({
    mutationFn: async (usage: { id: string; peca_id: string; quantidade: number; custo_unitario: number }) => {
      if (!ordem) return;
      // Remove usage record
      const { error: e1 } = await supabase.from("pecas_utilizadas").delete().eq("id", usage.id);
      if (e1) throw e1;

      // Return to stock
      const { data: peca } = await supabase.from("estoque").select("quantidade").eq("id", usage.peca_id).single();
      if (peca) {
        await supabase.from("estoque").update({
          quantidade: peca.quantidade + usage.quantidade,
        }).eq("id", usage.peca_id);
      }

      // Update OS custo_pecas
      const custoRemovido = usage.custo_unitario * usage.quantidade;
      await supabase.from("ordens_de_servico").update({
        custo_pecas: Math.max(0, (ordem.custo_pecas ?? 0) - custoRemovido),
      }).eq("id", ordem.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pecas_utilizadas", orderId] });
      queryClient.invalidateQueries({ queryKey: ["pecas_disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["pecas"] });
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Peça removida e estoque devolvido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async (newStatus: Status) => {
      if (!ordem) return;

      // Bloqueio: só permite "em_reparo" se orçamento aprovado
      const orcStatus = (ordem as any).aprovacao_orcamento;
      if (newStatus === "em_reparo" && orcStatus && orcStatus !== "aprovado") {
        throw new Error("Cliente ainda não aprovou o orçamento.");
      }
      // Bloqueio: se recusado, bloquear avanço (apenas voltar para "recebido" é permitido)
      if (orcStatus === "recusado" && newStatus !== "recebido") {
        throw new Error("Orçamento foi recusado pelo cliente. Reabra a aprovação para avançar.");
      }

      const updates: { status: Status; data_conclusao?: string; data_entrega?: string } = { status: newStatus };
      if (newStatus === "pronto") updates.data_conclusao = new Date().toISOString();
      if (newStatus === "entregue") updates.data_entrega = new Date().toISOString();

      const { error: e1 } = await supabase.from("ordens_de_servico").update(updates).eq("id", ordem.id);
      if (e1) throw e1;
      // Histórico registrado automaticamente pelo trigger
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["historico", orderId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes_os", orderId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      queryClient.invalidateQueries({ queryKey: ["aparelhos_assistencia"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const saveEdit = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!ordem) return;
      const valorStr = fd.get("valor") as string;
      const custoStr = fd.get("custo_pecas") as string;

      const { error } = await supabase.from("ordens_de_servico").update({
        defeito_relatado: fd.get("defeito_relatado") as string,
        diagnostico: (fd.get("diagnostico") as string) || null,
        servico_realizado: (fd.get("servico_realizado") as string) || null,
        valor: valorStr ? parseFloat(valorStr) : null,
        custo_pecas: custoStr ? parseFloat(custoStr) : null,
        tecnico: (fd.get("tecnico") as string) || null,
        observacoes: (fd.get("observacoes") as string) || null,
        previsao_entrega: (fd.get("previsao_entrega") as string) || null,
      }).eq("id", ordem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setEditing(false);
      toast.success("Ordem atualizada!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveEdit.mutate(new FormData(e.currentTarget));
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtCurrency = (v: number | null) => v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  const nextStatus = ordem ? statusFlow[statusFlow.indexOf(ordem.status) + 1] : null;

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => { if (!open) { setEditing(false); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading || !ordem ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">
                  {labelOS((ordem as any).numero, (ordem as any).numero_formatado)}
                </SheetTitle>
                <StatusBadge status={ordem.status} />
              </div>
            </SheetHeader>

            {/* Badge orçamento */}
            {(ordem as any).aprovacao_orcamento === "aguardando" && (
              <div className="mb-4 p-2.5 rounded-lg border border-warning/30 bg-warning/10 text-warning flex items-center gap-2 text-xs font-medium">
                <Clock className="h-3.5 w-3.5" />
                Aguardando aprovação do cliente
              </div>
            )}
            {(ordem as any).aprovacao_orcamento === "recusado" && (
              <div className="mb-4 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 text-xs font-medium">
                <X className="h-3.5 w-3.5" />
                Orçamento recusado pelo cliente
              </div>
            )}

            {/* Quick actions */}
            {ordem.status !== "entregue" && (
              <div className="flex gap-2 mb-5">
                {nextStatus && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (nextStatus === "entregue") {
                        pedirConfirmacao({
                          orderId: ordem.id,
                          numero: ordem.numero,
                          clienteNome: ordem.aparelhos?.clientes?.nome ?? "—",
                        });
                      } else {
                        changeStatus.mutate(nextStatus);
                      }
                    }}
                    disabled={changeStatus.isPending}
                  >
                    {changeStatus.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                    {statusLabels[nextStatus]}
                  </Button>
                )}
                {ordem.status !== "pronto" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus.mutate("pronto")}
                    disabled={changeStatus.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" />Pronto
                  </Button>
                )}
                {ordem.status === "pronto" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pedirConfirmacao({
                      orderId: ordem.id,
                      numero: ordem.numero,
                      clienteNome: ordem.aparelhos?.clientes?.nome ?? "—",
                    })}
                    disabled={changeStatus.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" />Entregar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printEtiquetaOS({
                    numero: ordem.numero,
                    clienteNome: ordem.aparelhos?.clientes?.nome || "",
                    clienteTelefone: ordem.aparelhos?.clientes?.telefone || "",
                    marca: ordem.aparelhos?.marca || "",
                    modelo: ordem.aparelhos?.modelo || "",
                    capacidade: ordem.aparelhos?.capacidade || null,
                    defeitos: ordem.defeito_relatado || "",
                    dataEntrada: ordem.data_entrada,
                    previsaoEntrega: ordem.previsao_entrega,
                    valor: ordem.valor,
                    imei: ordem.aparelhos?.imei || null,
                    tecnicoAtribuido: ordem.tecnico || null,
                  })}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Etiqueta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}

            {/* Status change dropdown (any status) */}
            {ordem.status !== "entregue" && (
              <div className="mb-5">
                <Label className="text-xs text-muted-foreground">Mudar para qualquer status</Label>
                <Select
                  value={ordem.status}
                  onValueChange={(v) => {
                    if (v === "entregue") {
                      pedirConfirmacao({
                        orderId: ordem.id,
                        numero: ordem.numero,
                        clienteNome: ordem.aparelhos?.clientes?.nome ?? "—",
                      });
                    } else {
                      changeStatus.mutate(v as Status);
                    }
                  }}
                  disabled={changeStatus.isPending}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusFlow.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator className="mb-5" />

            {editing ? (
              /* ── Edit mode ── */
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <Label className="text-xs">Defeito relatado</Label>
                  <Textarea name="defeito_relatado" defaultValue={ordem.defeito_relatado} className="mt-1 resize-none" rows={2} required />
                </div>
                <div>
                  <Label className="text-xs">Diagnóstico</Label>
                  <Textarea name="diagnostico" defaultValue={ordem.diagnostico ?? ""} className="mt-1 resize-none" rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Serviço realizado</Label>
                  <Textarea name="servico_realizado" defaultValue={ordem.servico_realizado ?? ""} className="mt-1 resize-none" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Valor estimado</Label><Input name="valor" type="number" step="0.01" defaultValue={ordem.valor ?? ""} className="mt-1 h-8" /></div>
                  <div><Label className="text-xs">Custo peças</Label><Input name="custo_pecas" type="number" step="0.01" defaultValue={ordem.custo_pecas ?? ""} className="mt-1 h-8" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Técnico</Label><Input name="tecnico" defaultValue={ordem.tecnico ?? ""} className="mt-1 h-8" /></div>
                  <div><Label className="text-xs">Previsão entrega</Label><Input name="previsao_entrega" type="date" defaultValue={ordem.previsao_entrega?.split("T")[0] ?? ""} className="mt-1 h-8" /></div>
                </div>
                <div>
                  <Label className="text-xs">Observações internas</Label>
                  <Textarea name="observacoes" defaultValue={ordem.observacoes ?? ""} className="mt-1 resize-none" rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={saveEdit.isPending}>
                  {saveEdit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar Alterações
                </Button>
              </form>
            ) : (
              /* ── View mode ── */
              <div className="space-y-5">
                {/* Cliente */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Cliente</p>
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{ordem.aparelhos?.clientes?.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{ordem.aparelhos?.clientes?.telefone}</span>
                    </div>
                    {ordem.aparelhos?.clientes?.email && (
                      <p className="text-xs text-muted-foreground pl-5">{ordem.aparelhos.clientes.email}</p>
                    )}
                  </div>
                </div>

                {/* Aparelho */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Aparelho</p>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{ordem.aparelhos?.marca} {ordem.aparelhos?.modelo}</span>
                    </div>
                    {(ordem.aparelhos?.cor || ordem.aparelhos?.capacidade || ordem.aparelhos?.imei) && (
                      <p className="text-xs text-muted-foreground mt-1.5 pl-5">
                        {[ordem.aparelhos.cor, ordem.aparelhos.capacidade, ordem.aparelhos.imei && `IMEI: ${ordem.aparelhos.imei}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Serviço */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Serviço</p>
                  <div className="space-y-2">
                    <InfoRow label="Defeito relatado" value={ordem.defeito_relatado} />

                    {/* Diagnóstico técnico - inline editable, visible after "recebido" */}
                    {ordem.status !== "recebido" && (
                      <div className="py-1.5 border-b">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Diagnóstico técnico</span>
                          {ordem.status !== "entregue" && !editingDiag && (
                            <button
                              type="button"
                              onClick={() => { setEditingDiag(true); setDiagValue(ordem.diagnostico ?? ""); }}
                              className="text-xs text-info hover:underline inline-flex items-center gap-1"
                            >
                              <Pencil className="h-3 w-3" />{ordem.diagnostico ? "Editar" : "Adicionar"}
                            </button>
                          )}
                        </div>
                        {editingDiag ? (
                          <div className="space-y-2">
                            <Textarea
                              value={diagValue}
                              onChange={(e) => setDiagValue(e.target.value)}
                              rows={2}
                              className="resize-none text-sm"
                              placeholder="O que o técnico identificou..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={saveEdit.isPending}
                                onClick={async () => {
                                  const { error } = await supabase.from("ordens_de_servico").update({ diagnostico: diagValue || null }).eq("id", ordem.id);
                                  if (error) { toast.error("Erro ao salvar"); return; }
                                  queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
                                  setEditingDiag(false);
                                  toast.success("Diagnóstico salvo!");
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />Salvar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingDiag(false)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-right">{ordem.diagnostico || "—"}</span>
                        )}
                      </div>
                    )}

                    {/* Serviço realizado - inline editable, visible when pronto/entregue */}
                    {(ordem.status === "pronto" || ordem.status === "entregue") && (
                      <div className="py-1.5 border-b last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Serviço realizado</span>
                          {ordem.status !== "entregue" && !editingServico && (
                            <button
                              type="button"
                              onClick={() => { setEditingServico(true); setServicoValue(ordem.servico_realizado ?? ""); }}
                              className="text-xs text-info hover:underline inline-flex items-center gap-1"
                            >
                              <Pencil className="h-3 w-3" />{ordem.servico_realizado ? "Editar" : "Adicionar"}
                            </button>
                          )}
                        </div>
                        {editingServico ? (
                          <div className="space-y-2">
                            <Textarea
                              value={servicoValue}
                              onChange={(e) => setServicoValue(e.target.value)}
                              rows={2}
                              className="resize-none text-sm"
                              placeholder="Descreva o que foi feito..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={saveEdit.isPending}
                                onClick={async () => {
                                  const { error } = await supabase.from("ordens_de_servico").update({ servico_realizado: servicoValue || null }).eq("id", ordem.id);
                                  if (error) { toast.error("Erro ao salvar"); return; }
                                  queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
                                  setEditingServico(false);
                                  toast.success("Serviço realizado salvo!");
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />Salvar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingServico(false)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-right">{ordem.servico_realizado || "—"}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Painel Orçamento */}
                {(() => {
                  const o = ordem as any;
                  const total = Number(o.valor_total ?? o.valor ?? 0);
                  const sinal = Number(o.sinal_pago ?? 0);
                  const desc = Number(o.desconto ?? 0);
                  const adic = Number(o.mao_obra_adicional ?? 0);
                  const pec = Number(o.custo_pecas ?? 0);
                  const aRec = Math.max(0, total - sinal);
                  if (total <= 0 && sinal <= 0) return null;
                  return (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Orçamento</p>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Peças (custo)</span><span className="font-medium">R$ {pec.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Mão de obra adicional</span><span className="font-medium">R$ {adic.toFixed(2)}</span></div>
                      {desc > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Desconto</span><span className="font-medium text-destructive">− R$ {desc.toFixed(2)}</span></div>}
                      <div className="border-t border-primary/20 pt-1.5 mt-1.5 flex justify-between text-sm font-bold"><span>TOTAL</span><span className="text-success">R$ {total.toFixed(2)}</span></div>
                      {sinal > 0 && (
                        <>
                          <div className="flex justify-between text-xs pt-1"><span className="text-muted-foreground">Sinal pago{o.forma_pagamento_sinal ? ` (${o.forma_pagamento_sinal})` : ""}</span><span className="font-medium text-success">− R$ {sinal.toFixed(2)}</span></div>
                          <div className="flex justify-between text-sm font-semibold border-t border-primary/20 pt-1.5 mt-1"><span>A receber na retirada</span><span className="text-primary">R$ {aRec.toFixed(2)}</span></div>
                        </>
                      )}
                      {o.garantia_dias != null && (
                        <p className="text-[10px] text-muted-foreground pt-1.5 border-t border-primary/20">Garantia do serviço: {o.garantia_dias} dias</p>
                      )}
                    </div>
                  );
                })()}

                {/* Valores e Lucro Real */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Valores & Lucro Real</p>
                  {(() => {
                    const valor = ordem.valor ?? 0;
                    const custoPecas = ordem.custo_pecas ?? 0;
                    const totalComissoes = comissoesOS.reduce((s, c) => s + Number(c.valor), 0);
                    const totalDespesas = despesasOS.reduce((s, d) => s + Number(d.valor), 0);
                    const lucroReal = valor - custoPecas - totalComissoes - totalDespesas;
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border p-2.5">
                            <p className="text-[10px] text-muted-foreground">Valor cobrado</p>
                            <p className="text-sm font-semibold mt-0.5">{fmtCurrency(ordem.valor)}</p>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <p className="text-[10px] text-muted-foreground">Custo peças</p>
                            <p className="text-sm font-semibold mt-0.5 text-destructive">{custoPecas > 0 ? `- ${fmtCurrency(custoPecas)}` : "—"}</p>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <p className="text-[10px] text-muted-foreground">Comissões</p>
                            <p className="text-sm font-semibold mt-0.5 text-warning">{totalComissoes > 0 ? `- ${fmtCurrency(totalComissoes)}` : "—"}</p>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <p className="text-[10px] text-muted-foreground">Despesas vinculadas</p>
                            <p className="text-sm font-semibold mt-0.5 text-destructive">{totalDespesas > 0 ? `- ${fmtCurrency(totalDespesas)}` : "—"}</p>
                          </div>
                        </div>
                        <div className={`rounded-lg border p-3 ${lucroReal > 0 ? "border-success/20 bg-success-muted" : lucroReal < 0 ? "border-destructive/20 bg-destructive/5" : ""}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium">Lucro Real</p>
                            <p className={`text-base font-bold ${lucroReal > 0 ? "text-success" : lucroReal < 0 ? "text-destructive" : ""}`}>
                              {valor > 0 ? fmtCurrency(lucroReal) : "—"}
                            </p>
                          </div>
                          {valor > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {fmtCurrency(valor)} − {fmtCurrency(custoPecas)} − {fmtCurrency(totalComissoes)} − {fmtCurrency(totalDespesas)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Peças utilizadas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Peças utilizadas</p>
                    {ordem.status !== "entregue" && !addingPart && (
                      <button
                        type="button"
                        onClick={() => setAddingPart(true)}
                        className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                      >
                        <Plus className="h-3 w-3" />Adicionar
                      </button>
                    )}
                  </div>

                  {addingPart && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-3 mb-3">
                      <div>
                        <Label className="text-xs">Peça</Label>
                        <Select value={selectedPecaId} onValueChange={setSelectedPecaId}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                          <SelectContent>
                            {pecasDisponiveis.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} — {p.quantidade} em estoque — R$ {Number(p.preco_custo ?? 0).toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Quantidade</Label>
                        <Input type="number" min={1} value={pecaQtd} onChange={(e) => setPecaQtd(Number(e.target.value))} className="mt-1 h-8" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!selectedPecaId || addPecaMutation.isPending}
                          onClick={() => addPecaMutation.mutate({ pecaId: selectedPecaId, qtd: pecaQtd })}
                        >
                          {addPecaMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          Registrar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddingPart(false); setSelectedPecaId(""); setPecaQtd(1); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {pecasUtilizadas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma peça registrada</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pecasUtilizadas.map((pu) => (
                        <div key={pu.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{(pu as any).estoque?.nome ?? "Peça"}</p>
                            <p className="text-xs text-muted-foreground">
                              {pu.quantidade}x — R$ {Number(pu.custo_unitario).toFixed(2)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              R$ {(pu.quantidade * Number(pu.custo_unitario)).toFixed(2)}
                            </span>
                            {ordem.status !== "entregue" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removePecaMutation.mutate({
                                  id: pu.id,
                                  peca_id: pu.peca_id,
                                  quantidade: pu.quantidade,
                                  custo_unitario: Number(pu.custo_unitario),
                                })}
                                disabled={removePecaMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="text-muted-foreground">Total peças</span>
                        <span className="font-semibold">
                          R$ {pecasUtilizadas.reduce((s, pu) => s + pu.quantidade * Number(pu.custo_unitario), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comissões da OS */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Comissões</p>
                  {comissoesOS.length > 0 ? (
                    <div className="space-y-1.5">
                      {comissoesOS.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{(c as any).funcionarios?.nome ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.tipo === "percentual" ? "Percentual" : "Fixa"} · {c.status}
                              {c.observacoes && ` · ${c.observacoes}`}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-warning">{fmtCurrency(c.valor)}</span>
                        </div>
                      ))}
                    </div>
                  ) : comissaoPreview ? (
                    <div className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-warning">Comissão prevista</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {comissaoPreview.tipo === "percentual" ? `${comissaoPreview.config}%` : fmtCurrency(comissaoPreview.config)}
                            {" · "}Regra {comissaoPreview.origem}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-warning">{fmtCurrency(comissaoPreview.calculado)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Será gerada automaticamente ao marcar como "Pronto"</p>
                    </div>
                  ) : ordem.funcionario_id ? (
                    <p className="text-xs text-muted-foreground">Nenhuma comissão configurada para este técnico/serviço</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Selecione um técnico para ver a comissão prevista</p>
                  )}
                </div>

                {/* Despesas vinculadas */}
                {despesasOS.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Despesas Vinculadas</p>
                    <div className="space-y-1.5">
                      {despesasOS.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{d.descricao}</p>
                            <p className="text-xs text-muted-foreground">{(d as any).fornecedores?.nome ?? ""} · {d.status}</p>
                          </div>
                          <span className="text-sm font-medium text-destructive">{fmtCurrency(Number(d.valor))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Detalhes</p>
                  <div className="space-y-2">
                    {(() => {
                      const func = funcionariosAtivos.find(f => f.id === ordem.funcionario_id);
                      const tipoServ = tiposServico.find(t => t.id === ordem.tipo_servico_id);
                      return (
                        <>
                          <InfoRow label="Técnico" value={func?.nome ?? ordem.tecnico ?? "—"} />
                          <InfoRow label="Tipo de serviço" value={tipoServ?.nome ?? "—"} />
                        </>
                      );
                    })()}
                    <InfoRow label="Data entrada" value={fmtDate(ordem.data_entrada)} />
                    <InfoRow label="Previsão entrega" value={fmtDate(ordem.previsao_entrega)} />
                    <InfoRow label="Conclusão" value={fmtDate(ordem.data_conclusao)} />
                    <InfoRow label="Entrega" value={fmtDate(ordem.data_entrega)} />
                  </div>
                </div>

                {/* Observações */}
                {ordem.observacoes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Observações internas</p>
                    <p className="text-sm bg-muted/50 rounded-lg p-3">{ordem.observacoes}</p>
                  </div>
                )}

                {/* Garantia */}
                {garantia && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Garantia</p>
                    {(() => {
                      const hoje = new Date();
                      const fim = new Date(garantia.data_fim);
                      const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      const isAtiva = garantia.status === "ativa" && diasRestantes > 0;
                      const isVencendo = isAtiva && diasRestantes <= 30;
                      const isVencida = diasRestantes <= 0 || garantia.status === "vencida";
                      const isUtilizada = garantia.status === "utilizada";
                      const borderColor = isUtilizada ? "border-muted" : isVencida ? "border-destructive/30" : isVencendo ? "border-warning/30" : "border-success/30";
                      const bgColor = isUtilizada ? "bg-muted/30" : isVencida ? "bg-destructive/5" : isVencendo ? "bg-warning/5" : "bg-success/5";
                      return (
                        <div className={cn("rounded-lg border p-3 space-y-2", borderColor, bgColor)}>
                          <div className="flex items-center gap-2">
                            <Shield className={cn("h-4 w-4", isUtilizada ? "text-muted-foreground" : isVencida ? "text-destructive" : isVencendo ? "text-warning" : "text-success")} />
                            <span className="text-sm font-medium">
                              {isUtilizada ? "Utilizada" : isVencida ? "Vencida" : isVencendo ? `Vencendo — ${diasRestantes} dias` : `Ativa — ${diasRestantes} dias restantes`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Início: {new Date(garantia.data_inicio).toLocaleDateString("pt-BR")} · Fim: {new Date(garantia.data_fim).toLocaleDateString("pt-BR")} ({garantia.dias_garantia} dias)
                          </p>
                          {isAtiva && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs gap-1.5 border-warning/50 text-warning hover:bg-warning/10"
                              onClick={async () => {
                                if (!ordem || !orderId) return;
                                const confirmed = confirm("Deseja criar uma nova OS de garantia vinculada a esta ordem?");
                                if (!confirmed) return;
                                try {
                                  // Create new OS linked to original
                                  const { data: novaOS, error: osError } = await supabase
                                    .from("ordens_de_servico")
                                    .insert({
                                      aparelho_id: ordem.aparelho_id,
                                      defeito_relatado: `[GARANTIA] Acionamento ref. OS #${ordem.numero}`,
                                      status: "recebido" as any,
                                      os_origem_id: orderId,
                                      retrabalho: true,
                                      loja_id: ordem.loja_id,
                                      funcionario_id: ordem.funcionario_id,
                                      tipo_servico_id: ordem.tipo_servico_id,
                                    })
                                    .select("id, numero")
                                    .single();
                                  if (osError) throw osError;

                                  // Mark guarantee as used
                                  await supabase
                                    .from("garantias")
                                    .update({ status: "utilizada" } as any)
                                    .eq("id", garantia.id);

                                  queryClient.invalidateQueries({ queryKey: ["garantia_os", orderId] });
                                  queryClient.invalidateQueries({ queryKey: ["ordens"] });
                                  queryClient.invalidateQueries({ queryKey: ["garantias_list"] });
                                  toast.success(`OS de garantia #${novaOS.numero} criada com sucesso!`);
                                } catch (err: any) {
                                  toast.error(err?.message || "Erro ao acionar garantia");
                                }
                              }}
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Acionar Garantia (Nova OS)
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Avaliação do cliente */}
                {avaliacao && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Avaliação do cliente</p>
                    <div className="rounded-lg border p-3">
                      <div className="flex gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn("h-4 w-4", n <= avaliacao.nota ? "fill-amber-400 text-amber-400" : "text-border")} />
                        ))}
                        <span className="text-xs text-muted-foreground ml-2">{avaliacao.nota}/5</span>
                      </div>
                      {avaliacao.comentario && <p className="text-xs text-muted-foreground mt-1">"{avaliacao.comentario}"</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(avaliacao.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                )}

                {/* Share link */}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      const link = `${window.location.origin}/portal/login?os=${ordem.numero}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Compartilhar link do portal
                  </Button>
                </div>

                {/* Histórico */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Histórico</p>
                  {historico.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada</p>
                  ) : (
                    <div className="space-y-0">
                      {historico.map((h, i) => (
                        <div key={h.id} className="flex gap-3 py-2">
                          <div className="flex flex-col items-center">
                            <div className="h-2 w-2 rounded-full bg-border mt-1.5" />
                            {i < historico.length - 1 && <div className="flex-1 w-px bg-border" />}
                          </div>
                          <div className="pb-2">
                            <p className="text-xs">
                              <span className="text-muted-foreground">{h.status_anterior ? statusLabels[h.status_anterior as Status] ?? h.status_anterior : "—"}</span>
                              {" → "}
                              <span className="font-medium">{statusLabels[h.status_novo as Status] ?? h.status_novo}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              <Clock className="inline h-3 w-3 mr-0.5 -mt-px" />
                              {fmtDateTime(h.created_at)}
                            </p>
                            {h.observacao && <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
      <ConfirmarEntregaDialog
        entrega={entrega}
        onConfirm={(id) => {
          changeStatus.mutate("entregue");
          cancelar();
        }}
        onCancel={cancelar}
      />
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
