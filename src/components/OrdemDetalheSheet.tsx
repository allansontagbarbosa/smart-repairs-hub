import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChecklistEntrada, type ChecklistStatus } from "@/components/ChecklistEntrada";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Pencil, X, Check, ChevronRight, Phone, Smartphone, Clock, User, Plus, Trash2, Printer, Star, Copy, Share2, Shield, FileText, Info, History, Ban, AlertTriangle, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import { CancelarOSDialog } from "@/components/CancelarOSDialog";
import { printEtiquetaOS } from "@/lib/printEtiqueta";
import { cn } from "@/lib/utils";
import { formatNumeroOS, labelOS } from "@/lib/numeroOS";
import { ImpressaoOS, type ImpressaoOSData } from "@/components/ImpressaoOS";
import { ResultadoFinanceiroOS } from "@/components/ResultadoFinanceiroOS";
import { useReactToPrint } from "react-to-print";
import { usePermissoes } from "@/hooks/usePermissoes";
import { ServicosSelector, type ServicoSelecionado } from "@/components/ServicosSelector";
import { ServicosOSEditor } from "@/components/ordens/ServicosOSEditor";
import { useOSServicos } from "@/hooks/useOSServicos";
import { invalidateOrdensDependentes } from "@/lib/cacheInvalidation";
import { useEmpresa } from "@/contexts/EmpresaContext";




interface Props {
  orderId: string | null;
  onClose: () => void;
}

export function OrdemDetalheSheet({ orderId, onClose }: Props) {
  const { empresaId } = useEmpresa();
  const [editing, setEditing] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [selectedPecaId, setSelectedPecaId] = useState("");
  const [pecaQtd, setPecaQtd] = useState(1);
  const [editingDiag, setEditingDiag] = useState(false);
  const [diagValue, setDiagValue] = useState("");
  const [editingServico, setEditingServico] = useState(false);
  const [servicoValue, setServicoValue] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ novo: Status; motivos: string[] } | null>(null);
  const [valorWarningOpen, setValorWarningOpen] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, any> | null>(null);

  // Edição de serviços vinculados (os_servicos)
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoSelecionado[]>([]);
  const [removeServicosWarnOpen, setRemoveServicosWarnOpen] = useState(false);
  const [pendingRemovedServicos, setPendingRemovedServicos] = useState<Array<{ id: string; nome: string; comissao: number }>>([]);

  // Estado controlado dos campos do form de edição (para Selects/radios shadcn)
  const [editForm, setEditForm] = useState({
    lojista_id: "",
    contato_preferido: "whatsapp",
    forma_pagamento_sinal: "nenhum",
    liga: "sim",
    aprovado_no_ato: false,
    checklist_itens: {} as Record<string, ChecklistStatus>,
    checklist_custom: [] as { key: string; label: string }[],
  });

  const queryClient = useQueryClient();
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();
  const printRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = usePermissoes();

  // Bloqueia entrada não-admin no modo edição
  useEffect(() => {
    if (editing && !isAdmin) {
      toast.error("Apenas administradores podem editar OS");
      setEditing(false);
    }
  }, [editing, isAdmin]);

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
        .select("*, estoque_itens:peca_id ( nome_personalizado, sku, ativo, deleted_at )")
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
        .select("*, funcionarios ( nome ), os_servicos!inner ( id, nome, ordem_id )")
        .eq("os_servicos.ordem_id", orderId)
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

  // Fetch tipos_servico and técnicos para atribuição de OS
  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos_servico_os"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });
  const { data: funcionariosAtivos = [] } = useQuery<any[]>({
    queryKey: ["tecnicos_os", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("funcionario_id, nome_exibicao, funcionarios!inner(id, nome, tipo_comissao, valor_comissao, cargo, funcao, ativo, deleted_at), perfis_acesso!inner(nome_perfil)")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .eq("perfis_acesso.nome_perfil", "Técnico")
        .not("funcionario_id", "is", null);

      if (error) throw error;

      return (data ?? [])
        .filter((up: any) =>
          up.funcionario_id
          && up.funcionarios?.ativo
          && !up.funcionarios?.deleted_at
        )
        .map((up: any) => ({ ...up.funcionarios, id: up.funcionario_id, nome: up.funcionarios?.nome || up.nome_exibicao }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const tecnicoAtualForaDaLista = ordem?.funcionario_id && !funcionariosAtivos.some((f) => f.id === ordem.funcionario_id)
    ? { id: ordem.funcionario_id, nome: ordem.tecnico || "Atribuição atual", atual: true }
    : null;
  const tecnicos = tecnicoAtualForaDaLista ? [tecnicoAtualForaDaLista, ...funcionariosAtivos] : funcionariosAtivos;

  // Lista de lojistas ativos da empresa
  const { data: lojistasAtivos = [] } = useQuery({
    queryKey: ["lojistas_ativos_os"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojistas")
        .select("id, nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      return data || [];
    },
  });

  // Hidrata editForm quando entra em modo edição
  useEffect(() => {
    if (editing && ordem) {
      const o = ordem as any;
      const cl = o.checklist_entrada || {};
      setEditForm({
        lojista_id: o.lojista_id ?? "",
        contato_preferido: o.contato_preferido ?? "whatsapp",
        forma_pagamento_sinal: o.forma_pagamento_sinal ?? "nenhum",
        liga: o.liga ?? "sim",
        aprovado_no_ato: !!o.aprovado_no_ato,
        checklist_itens: (cl.itens && typeof cl.itens === "object") ? cl.itens : {},
        checklist_custom: Array.isArray(cl.custom) ? cl.custom : [],
      });
    }
  }, [editing, ordem]);

  // ─── Serviços vinculados (os_servicos) — atuais e estado em edição ───
  const { data: servicosAtuais = [] } = useQuery({
    queryKey: ["os-servicos", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("os_servicos")
        .select("id, servico_id, nome, valor, comissao, categoria")
        .eq("ordem_id", orderId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  // Hidrata servicosSelecionados ao entrar em edição (chave = servico_id, fallback id)
  useEffect(() => {
    if (editing) {
      setServicosSelecionados(
        (servicosAtuais as any[]).map((s) => ({
          id: s.servico_id ?? s.id,
          nome: s.nome,
          categoria: s.categoria ?? undefined,
          valor_mao_obra: Number(s.valor) || 0,
          comissao_padrao: Number(s.comissao) || 0,
        }))
      );
    }
  }, [editing, servicosAtuais]);

  // Mutation: editar_os_servicos
  const editarServicos = useMutation({
    mutationFn: async (args: { adicionar: string[]; remover: string[] }) => {
      if (!ordem) return null;
      const { data, error } = await supabase.rpc("editar_os_servicos" as any, {
        p_ordem_id: ordem.id,
        p_adicionar: args.adicionar,
        p_remover: args.remover,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["os-servicos", orderId] });
      queryClient.invalidateQueries({ queryKey: ["os_auditoria", orderId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes_os", orderId] });
      queryClient.invalidateQueries({ queryKey: ["historico", orderId] });
      const add = data?.adicionados ?? 0;
      const rem = data?.removidos ?? 0;
      if (add > 0 || rem > 0) {
        toast.success(
          `Serviços atualizados (${add > 0 ? `+${add}` : ""}${add > 0 && rem > 0 ? " / " : ""}${rem > 0 ? `-${rem}` : ""})`
        );
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar serviços"),
  });

  // Calcula diff serviços. ADD = servico_id (tipo_servico). REMOVE = os_servicos.id.
  const calcDiffServicos = () => {
    const atuaisMap = new Map<string, any>(); // servico_id -> row os_servicos
    for (const s of servicosAtuais as any[]) {
      if (s.servico_id) atuaisMap.set(s.servico_id, s);
    }
    const selecMap = new Map<string, ServicoSelecionado>();
    for (const s of servicosSelecionados) selecMap.set(s.id, s);

    const adicionar: string[] = [];
    for (const id of selecMap.keys()) {
      if (!atuaisMap.has(id)) adicionar.push(id);
    }
    const remover: string[] = [];
    const removerInfo: Array<{ id: string; nome: string; comissao: number }> = [];
    for (const [servicoId, row] of atuaisMap) {
      if (!selecMap.has(servicoId)) {
        remover.push(row.id);
        removerInfo.push({ id: row.id, nome: row.nome, comissao: Number(row.comissao) || 0 });
      }
    }
    return { adicionar, remover, removerInfo };
  };

  // Criador da OS (para o header enriquecido)
  const { data: criador } = useQuery({
    queryKey: ["criador_os", (ordem as any)?.created_by, (ordem as any)?.criada_retroativamente_por],
    queryFn: async () => {
      const o = ordem as any;
      const userId = o?.criada_retroativamente_por;
      if (userId) {
        const { data } = await supabase
          .from("user_profiles")
          .select("nome_exibicao")
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();
        if (data?.nome_exibicao) return data.nome_exibicao;
      }
      return o?.created_by || null;
    },
    enabled: !!ordem,
  });

  // Histórico de auditoria (drawer)
  const { data: historicoAuditoria = [] } = useQuery({
    queryKey: ["os_auditoria", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("os_auditoria" as any)
        .select("*")
        .eq("ordem_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId && historicoOpen,
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
      const { data, error } = await (supabase.from("estoque_itens") as any)
        .select("id, nome_personalizado, sku, quantidade, custo_unitario, custo_medio")
        .eq("tipo_item", "peca")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome_personalizado");
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

      // Insert usage record
      const { error: e1 } = await supabase.from("pecas_utilizadas").insert({
        ordem_id: ordem.id,
        peca_id: pecaId,
        quantidade: qtd,
        custo_unitario: peca.custo_medio ?? peca.custo_unitario ?? 0,
      });
      if (e1) throw e1;

      // Deduct from stock (permite estoque negativo)
      const { error: e2 } = await supabase.from("estoque_itens").update({
        quantidade: peca.quantidade - qtd,
      }).eq("id", pecaId);
      if (e2) throw e2;

      // Update OS custo_pecas
      const custoAdicional = (peca.custo_medio ?? peca.custo_unitario ?? 0) * qtd;
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
      invalidateOrdensDependentes(queryClient);
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
      const { data: peca } = await supabase.from("estoque_itens").select("quantidade").eq("id", usage.peca_id).single();
      if (peca) {
        await supabase.from("estoque_itens").update({
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
      invalidateOrdensDependentes(queryClient);
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

      const now = new Date().toISOString();
      const updates: { status: Status; data_conclusao?: string; data_entrega?: string } = { status: newStatus };
      if (newStatus === "pronto" && !(ordem as any).data_conclusao) {
        updates.data_conclusao = now;
      }
      if (newStatus === "entregue") {
        if (!(ordem as any).data_entrega) updates.data_entrega = now;
        if (!(ordem as any).data_conclusao) updates.data_conclusao = (ordem as any).data_entrega || now;
      }

      const { error: e1 } = await supabase.from("ordens_de_servico").update(updates).eq("id", ordem.id);
      if (e1) throw e1;
      // Histórico registrado automaticamente pelo trigger
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["historico", orderId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes_os", orderId] });
      invalidateOrdensDependentes(queryClient);
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  // ─── Detecção de pulo de fluxo ───
  const detectarPulosFluxo = async (statusAtual: Status, novoStatus: Status): Promise<string[]> => {
    if (!ordem) return [];
    const motivos: string[] = [];
    const idxAtual = statusFlow.indexOf(statusAtual);
    const idxNovo = statusFlow.indexOf(novoStatus);

    // Pulo de etapas (mais de uma posição à frente)
    if (idxNovo > idxAtual + 1) {
      const puladas = statusFlow.slice(idxAtual + 1, idxNovo).map(s => statusLabels[s]);
      motivos.push(`Esta mudança pula ${puladas.length} etapa(s): ${puladas.join(", ")}`);
    }

    // Pronto sem checklist de saída
    if (novoStatus === "pronto") {
      const { count } = await supabase
        .from("os_checklist_saida" as any)
        .select("id", { count: "exact", head: true })
        .eq("ordem_id", ordem.id);
      if (!count || count === 0) {
        motivos.push("Esta OS não passou pelo checklist de saída do técnico");
      }
    }

    // Entregue sem assinatura digital do cliente
    if (novoStatus === "entregue") {
      const { count } = await supabase
        .from("assinaturas_digitais")
        .select("id", { count: "exact", head: true })
        .eq("ordem_id", ordem.id)
        .eq("tipo", "cliente_entrega");
      if (!count || count === 0) {
        motivos.push("Esta OS não tem assinatura digital do cliente registrada");
      }
    }

    return motivos;
  };

  // ─── Mutation: editar OS via RPC ───
  const editarOSAdmin = useMutation({
    mutationFn: async (args: { dados: Record<string, any>; pulou_fluxo?: boolean; motivo_pulo?: string | null }) => {
      if (!ordem) return null;
      const { data, error } = await supabase.rpc("editar_os_admin" as any, {
        p_ordem_id: ordem.id,
        p_dados: args.dados,
        p_pulou_fluxo: args.pulou_fluxo ?? false,
        p_motivo_pulo: args.motivo_pulo ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      queryClient.invalidateQueries({ queryKey: ["historico", orderId] });
      queryClient.invalidateQueries({ queryKey: ["os_auditoria", orderId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes_os", orderId] });
      invalidateOrdensDependentes(queryClient);
      const n = data?.campos_alterados ?? 0;
      const formatted = formatNumeroOS((ordem as any)?.numero, (ordem as any)?.numero_formatado);
      if (n === 0) {
        // No-op silencioso
      } else if (data?.pulou_fluxo) {
        toast.success(`OS ${formatted} atualizada com pulo de fluxo. Registrado em auditoria.`);
      } else {
        toast.success(`OS ${formatted} atualizada (${n} ${n === 1 ? "campo alterado" : "campos alterados"})`);
      }
      setEditing(false);
      setPendingEditPayload(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  // ─── saveEdit (compat com forma antiga via FormData) ───
  const saveEdit = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!ordem) return null;
      const { data, error } = await supabase.rpc("editar_os_admin" as any, {
        p_ordem_id: ordem.id,
        p_dados: payload,
        p_pulou_fluxo: false,
        p_motivo_pulo: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
      invalidateOrdensDependentes(queryClient);
      setEditing(false);
      toast.success("Ordem atualizada!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  // Calcular diff frontend (somente p/ saber se muda algo)
  const calcularDiff = (original: any, atual: Record<string, any>): Record<string, [any, any]> => {
    const diff: Record<string, [any, any]> = {};
    for (const k of Object.keys(atual)) {
      const a = original?.[k] ?? null;
      const b = atual[k] === "" ? null : atual[k];
      // Normaliza datas e números
      const aN = a == null ? null : String(a);
      const bN = b == null ? null : String(b);
      if (aN !== bN) diff[k] = [a, b];
    }
    return diff;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ordem || !isAdmin) {
      toast.error("Apenas administradores podem editar OS");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const valorStr = (fd.get("valor") as string) || "";
    const previsaoStr = (fd.get("previsao_entrega") as string) || "";
    const lojistaIdStr = (fd.get("lojista_id") as string) || "";
    const maoObraStr = (fd.get("mao_obra_adicional") as string) || "";
    const descontoStr = (fd.get("desconto") as string) || "";
    const sinalStr = (fd.get("sinal_pago") as string) || "";
    const bateriaStr = (fd.get("bateria_entrada") as string) || "";
    const formaPag = (fd.get("forma_pagamento_sinal") as string) || "";
    const liga = (fd.get("liga") as string) || "";
    const contatoPref = (fd.get("contato_preferido") as string) || "";

    // Validações
    if (valorStr && (isNaN(parseFloat(valorStr)) || parseFloat(valorStr) < 0)) {
      toast.error("Valor cobrado inválido"); return;
    }
    if (lojistaIdStr && !/^[0-9a-f-]{36}$/i.test(lojistaIdStr)) {
      toast.error("Lojista inválido"); return;
    }
    for (const [label, raw] of [["Mão de obra adicional", maoObraStr], ["Desconto", descontoStr], ["Sinal pago", sinalStr]] as const) {
      if (raw && (isNaN(parseFloat(raw)) || parseFloat(raw) < 0)) {
        toast.error(`${label} deve ser ≥ 0`); return;
      }
    }
    if (bateriaStr) {
      const b = parseInt(bateriaStr, 10);
      if (isNaN(b) || b < 0 || b > 100) { toast.error("Bateria deve estar entre 0 e 100"); return; }
    }
    if (liga && !["sim", "nao", "parcial"].includes(liga)) { toast.error("Estado 'liga' inválido"); return; }
    if (contatoPref && !["whatsapp", "ligacao", "sms", "email"].includes(contatoPref)) {
      toast.error("Contato preferido inválido"); return;
    }
    if (formaPag && !["nenhum", "dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto", "transferencia"].includes(formaPag)) {
      toast.error("Forma de pagamento do sinal inválida"); return;
    }

    // Checklist (vem do state, não do FormData)
    const temChecklist = Object.keys(editForm.checklist_itens).length > 0 || editForm.checklist_custom.length > 0;
    const checklistPayload = temChecklist
      ? { itens: editForm.checklist_itens, custom: editForm.checklist_custom }
      : null;

    const payload: Record<string, any> = {
      // Diagnóstico/relato
      defeito_relatado: fd.get("defeito_relatado") as string,
      diagnostico: (fd.get("diagnostico") as string) || "",
      servico_realizado: (fd.get("servico_realizado") as string) || "",
      relato_cliente: (fd.get("relato_cliente") as string) || "",
      obs_cliente: (fd.get("obs_cliente") as string) || "",
      observacoes: (fd.get("observacoes") as string) || "",
      // Operacional
      previsao_entrega: previsaoStr ? new Date(previsaoStr).toISOString() : "",
      prioridade: (fd.get("prioridade") as string) || "normal",
      localizacao: (fd.get("localizacao") as string) || "",
      lojista_id: lojistaIdStr,
      contato_preferido: contatoPref,
      // Financeiro
      valor: valorStr,
      mao_obra_adicional: maoObraStr || "0",
      desconto: descontoStr || "0",
      sinal_pago: sinalStr || "0",
      forma_pagamento_sinal: formaPag === "nenhum" ? "" : formaPag,
      garantia_dias: (fd.get("garantia_dias") as string) || "",
      aprovacao_orcamento: (fd.get("aprovacao_orcamento") as string) || "",
      aprovado_no_ato: editForm.aprovado_no_ato,
      // Estado entrada
      liga: liga || "",
      bateria_entrada: bateriaStr || "",
      estado_geral: (fd.get("estado_geral") as string) || "",
      checklist_entrada: checklistPayload,
    };

    // Diff de campos da OS
    const diff = calcularDiff(ordem, payload);
    const camposAlterados = Object.keys(diff).length > 0;

    // Diff dos serviços vinculados
    const { adicionar, remover, removerInfo } = calcDiffServicos();
    const servicosAlterados = adicionar.length > 0 || remover.length > 0;

    // Nada mudou? fecha
    if (!camposAlterados && !servicosAlterados) {
      setEditing(false);
      return;
    }

    // Função interna que dispara as duas mutations (campos + serviços) na ordem
    const dispatchAll = (campos: Record<string, any> | null) => {
      if (campos) {
        editarOSAdmin.mutate({ dados: campos, pulou_fluxo: false });
      } else {
        // só serviços mudaram → fecha edição manualmente após sucesso
        setEditing(false);
      }
      if (servicosAlterados) {
        editarServicos.mutate({ adicionar, remover });
      }
    };

    // Se vamos remover serviços com comissão > 0, confirmar primeiro
    const removidosComComissao = removerInfo.filter((r) => r.comissao > 0);
    if (removidosComComissao.length > 0) {
      setPendingRemovedServicos(removidosComComissao);
      setPendingEditPayload(camposAlterados ? payload : null);
      setRemoveServicosWarnOpen(true);
      return;
    }

    // Warning se valor mudou e já existe comissão
    const valorNovo = valorStr ? parseFloat(valorStr) : null;
    const valorAtual = (ordem as any).valor ?? null;
    if (camposAlterados && valorNovo !== valorAtual && comissoesOS.length > 0) {
      setPendingEditPayload(payload);
      setValorWarningOpen(true);
      // serviços (sem comissão) podem seguir junto
      if (servicosAlterados) editarServicos.mutate({ adicionar, remover });
      return;
    }

    dispatchAll(camposAlterados ? payload : null);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const brl = (v: number | null | undefined) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
  const fmtCurrency = (v: number | null | undefined) => brl(v);

  const nextStatus = ordem ? statusFlow[statusFlow.indexOf(ordem.status) + 1] : null;

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => { if (!open) { setEditing(false); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading || !ordem ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <SheetHeader className="pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">
                  {labelOS((ordem as any).numero, (ordem as any).numero_formatado)}
                </SheetTitle>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 text-left">
                <p className="truncate">
                  <span className="font-medium text-foreground">{ordem.aparelhos?.clientes?.nome ?? "—"}</span>
                  {" • "}
                  {ordem.aparelhos?.marca} {ordem.aparelhos?.modelo}
                  {ordem.aparelhos?.imei ? <> {" • "}IMEI {String(ordem.aparelhos.imei).slice(0, 8)}…</> : null}
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <StatusBadge status={ordem.status} />
                  {(ordem as any).eh_retroativa && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="bg-info/15 text-info border-info/30 gap-1 cursor-help">
                            <Clock className="h-3 w-3" />Retroativa
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-medium mb-0.5">Cadastro retroativo</p>
                          <p className="text-xs">{(ordem as any).justificativa_retroativa || "—"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-[11px] pt-0.5">
                  Cadastrada por <span className="text-foreground">{criador || "—"}</span>
                  {" em "}{new Date(ordem.created_at).toLocaleDateString("pt-BR")} às {new Date(ordem.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </SheetHeader>

            {ordem.status === "cancelado" && (
              <div className="mb-4 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <X className="h-4 w-4" /> OS Cancelada
                </div>
                {(ordem as any).cancelada_em && (
                  <p>Em: {new Date((ordem as any).cancelada_em).toLocaleString("pt-BR")}</p>
                )}
                {(ordem as any).motivo_cancelamento && (
                  <p>Motivo: {(ordem as any).motivo_cancelamento}</p>
                )}
                {(ordem as any).impacto_cancelamento && (
                  <div className="text-[11px] opacity-90 pt-1">
                    {(ordem as any).impacto_cancelamento.qtd_pecas > 0 && (
                      <p>🔧 {(ordem as any).impacto_cancelamento.qtd_pecas} peça(s) — R$ {Number((ordem as any).impacto_cancelamento.total_pecas ?? 0).toFixed(2)}</p>
                    )}
                    {(ordem as any).impacto_cancelamento.qtd_comissoes > 0 && (
                      <p>💰 {(ordem as any).impacto_cancelamento.qtd_comissoes} comissão(es) estornada(s) — R$ {Number((ordem as any).impacto_cancelamento.total_comissao ?? 0).toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

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
            {ordem.status !== "entregue" && ordem.status !== "cancelado" && (
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
                  variant="outline"
                  onClick={() => handlePrint()}
                  title="Imprimir / Salvar PDF da OS"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  OS / PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHistoricoOpen(true)}
                  title="Histórico de auditoria"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(!editing)}
                    title={editing ? "Fechar edição" : "Editar OS"}
                  >
                    {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {isAdmin && ["recebido", "em_analise", "aguardando_aprovacao"].includes(ordem.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setCancelOpen(true)}
                    title="Cancelar OS"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Botão imprimir para OS já entregue */}
            {ordem.status === "entregue" && (
              <div className="flex gap-2 mb-5">
                <Button size="sm" variant="outline" onClick={() => handlePrint()}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Imprimir / PDF da OS
                </Button>
              </div>
            )}

            {/* Status change dropdown (sem 'cancelado'; cancelamento é via botão dedicado) */}
            {ordem.status !== "entregue" && ordem.status !== "cancelado" && (
              <div className="mb-5">
                <Label className="text-xs text-muted-foreground">Mudar para qualquer status</Label>
                <Select
                  value={ordem.status}
                  onValueChange={async (v) => {
                    const novo = v as Status;
                    if (novo === ordem.status) return;
                    if (novo === "entregue") {
                      // entrega usa fluxo dedicado
                      const motivos = isAdmin ? await detectarPulosFluxo(ordem.status, novo) : [];
                      if (motivos.length > 0) {
                        setPendingStatusChange({ novo, motivos });
                        return;
                      }
                      pedirConfirmacao({
                        orderId: ordem.id,
                        numero: ordem.numero,
                        clienteNome: ordem.aparelhos?.clientes?.nome ?? "—",
                      });
                      return;
                    }
                    if (isAdmin) {
                      const motivos = await detectarPulosFluxo(ordem.status, novo);
                      if (motivos.length > 0) {
                        setPendingStatusChange({ novo, motivos });
                        return;
                      }
                    }
                    changeStatus.mutate(novo);
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
              /* ── Edit mode (Admin) — Accordion 4 seções ── */
              <form onSubmit={handleSave} className="space-y-4">
                <Accordion type="multiple" defaultValue={["diagnostico-servico"]} className="w-full">

                  {/* ─── A) Diagnóstico e Serviço ─── */}
                  <AccordionItem value="diagnostico-servico">
                    <AccordionTrigger className="text-sm font-semibold">Diagnóstico e Serviço</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div>
                        <Label className="text-xs">Defeito relatado</Label>
                        <Textarea name="defeito_relatado" defaultValue={ordem.defeito_relatado} className="mt-1 resize-none" rows={2} required />
                      </div>
                      <div>
                        <Label className="text-xs">Relato literal do cliente</Label>
                        <Textarea name="relato_cliente" defaultValue={(ordem as any).relato_cliente ?? ""} className="mt-1 resize-none" rows={2} placeholder="O que ele disse quando trouxe" />
                      </div>
                      <div>
                        <Label className="text-xs">Diagnóstico técnico</Label>
                        <Textarea name="diagnostico" defaultValue={ordem.diagnostico ?? ""} className="mt-1 resize-none" rows={2} />
                      </div>
                      <div>
                        <Label className="text-xs">Serviço realizado</Label>
                        <Textarea name="servico_realizado" defaultValue={ordem.servico_realizado ?? ""} className="mt-1 resize-none" rows={2} />
                      </div>
                      <div>
                        <Label className="text-xs">Observações visíveis ao cliente</Label>
                        <Textarea name="obs_cliente" defaultValue={(ordem as any).obs_cliente ?? ""} className="mt-1 resize-none" rows={2} placeholder="Aparece no PDF e WhatsApp" />
                      </div>
                      <div>
                        <Label className="text-xs">Observações internas (só equipe vê)</Label>
                        <Textarea name="observacoes" defaultValue={ordem.observacoes ?? ""} className="mt-1 resize-none" rows={2} />
                      </div>
                      <div className="pt-2 border-t">
                        <ServicosSelector
                          value={servicosSelecionados}
                          onChange={setServicosSelecionados}
                          label="Serviços vinculados"
                          hint="Busque e adicione os serviços feitos nesta OS. Remover um serviço estorna a comissão vinculada."
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">
                        Para adicionar/remover peças, use as ações dedicadas fora deste formulário.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ─── B) Operacional ─── */}
                  <AccordionItem value="operacional">
                    <AccordionTrigger className="text-sm font-semibold">Operacional</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <Alert className="border-info/30 bg-info/10 text-info">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Os técnicos se atribuem aos serviços pelo portal do técnico ao iniciar cada um.
                          </AlertDescription>
                        </Alert>
                        <div>
                          <Label className="text-xs">Previsão entrega</Label>
                          <Input name="previsao_entrega" type="date" defaultValue={ordem.previsao_entrega?.split("T")[0] ?? ""} className="mt-1 h-8" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Prioridade</Label>
                          <select name="prioridade" defaultValue={(ordem as any).prioridade || "normal"} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                            <option value="normal">Normal</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Localização física</Label>
                          <Input name="localizacao" defaultValue={(ordem as any).localizacao ?? ""} placeholder="Ex: gaveta 3, bancada azul" className="mt-1 h-8" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Lojista vinculado (opcional)</Label>
                        <Select
                          value={editForm.lojista_id || "__none__"}
                          onValueChange={(v) => setEditForm(p => ({ ...p, lojista_id: v === "__none__" ? "" : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Sem lojista —</SelectItem>
                            {lojistasAtivos.map((l: any) => (
                              <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="lojista_id" value={editForm.lojista_id} />
                      </div>
                      <div>
                        <Label className="text-xs">Contato preferido</Label>
                        <div className="mt-1 flex gap-3 flex-wrap">
                          {(["whatsapp", "ligacao", "sms", "email"] as const).map((c) => (
                            <label key={c} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                value={c}
                                checked={editForm.contato_preferido === c}
                                onChange={() => setEditForm(p => ({ ...p, contato_preferido: c }))}
                                className="accent-primary"
                              />
                              <span className="capitalize">{c === "ligacao" ? "Ligação" : c}</span>
                            </label>
                          ))}
                        </div>
                        <input type="hidden" name="contato_preferido" value={editForm.contato_preferido} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ─── C) Financeiro ─── */}
                  <AccordionItem value="financeiro">
                    <AccordionTrigger className="text-sm font-semibold">Financeiro</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Valor cobrado</Label>
                          <Input name="valor" type="number" step="0.01" min="0" defaultValue={ordem.valor ?? ""} className="mt-1 h-8" />
                        </div>
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            Custo de peças
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Calculado automaticamente das peças vinculadas. Para alterar, adicione/remova peças no scanner.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="mt-1 px-3 h-8 flex items-center bg-muted rounded-md text-sm">
                            {brl(ordem.custo_pecas)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            Mão de obra adicional
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Adicional manual sobre o valor dos serviços.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input name="mao_obra_adicional" type="number" step="0.01" min="0" defaultValue={(ordem as any).mao_obra_adicional ?? 0} className="mt-1 h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Desconto</Label>
                          <Input name="desconto" type="number" step="0.01" min="0" defaultValue={(ordem as any).desconto ?? 0} className="mt-1 h-8" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Sinal pago</Label>
                          <Input name="sinal_pago" type="number" step="0.01" min="0" defaultValue={(ordem as any).sinal_pago ?? 0} className="mt-1 h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Forma do sinal</Label>
                          <Select
                            value={editForm.forma_pagamento_sinal || "nenhum"}
                            onValueChange={(v) => setEditForm(p => ({ ...p, forma_pagamento_sinal: v }))}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Nenhum</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                              <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                              <SelectItem value="transferencia">Transferência</SelectItem>
                            </SelectContent>
                          </Select>
                          <input type="hidden" name="forma_pagamento_sinal" value={editForm.forma_pagamento_sinal} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Garantia (dias)</Label>
                          <Input name="garantia_dias" type="number" min="0" defaultValue={(ordem as any).garantia_dias ?? 90} className="mt-1 h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Aprovação</Label>
                          <select name="aprovacao_orcamento" defaultValue={(ordem as any).aprovacao_orcamento || "pendente"} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                            <option value="pendente">Pendente</option>
                            <option value="aprovado">Aprovado</option>
                            <option value="recusado">Recusado</option>
                          </select>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={editForm.aprovado_no_ato}
                          onChange={(e) => setEditForm(p => ({ ...p, aprovado_no_ato: e.target.checked }))}
                          className="accent-primary"
                        />
                        Cliente aprovou orçamento na hora
                      </label>
                      {comissoesOS.length > 0 && (
                        <div className="text-[11px] text-muted-foreground p-2 bg-muted/50 rounded border">
                          ⚠️ Esta OS já gerou comissão. Mudar o valor não recalcula automaticamente.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* ─── D) Estado na Entrada ─── */}
                  <AccordionItem value="estado-entrada">
                    <AccordionTrigger className="text-sm font-semibold">Estado na Entrada</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div>
                        <Label className="text-xs">Aparelho liga?</Label>
                        <div className="mt-1 flex gap-3">
                          {(["sim", "nao", "parcial"] as const).map((v) => (
                            <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                value={v}
                                checked={editForm.liga === v}
                                onChange={() => setEditForm(p => ({ ...p, liga: v }))}
                                className="accent-primary"
                              />
                              <span className="capitalize">{v === "nao" ? "Não" : v}</span>
                            </label>
                          ))}
                        </div>
                        <input type="hidden" name="liga" value={editForm.liga} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Bateria entrada (%)</Label>
                          <Input name="bateria_entrada" type="number" min="0" max="100" defaultValue={(ordem as any).bateria_entrada ?? ""} className="mt-1 h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Estado geral</Label>
                          <Input name="estado_geral" defaultValue={(ordem as any).estado_geral ?? ""} className="mt-1 h-8" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Checklist de entrada</Label>
                        <ChecklistEntrada
                          value={editForm.checklist_itens}
                          onChange={(v) => setEditForm(p => ({ ...p, checklist_itens: v }))}
                          customItems={editForm.checklist_custom}
                          onCustomItemsChange={(items) => setEditForm(p => ({ ...p, checklist_custom: items }))}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>

                <Button type="submit" className="w-full" disabled={editarOSAdmin.isPending || saveEdit.isPending}>
                  {(editarOSAdmin.isPending || saveEdit.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
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
                  const servico = Number(o.valor_total_servicos ?? o.valor ?? 0);
                  const pecasCobradas = Number(o.valor_total_pecas ?? 0);
                  const adic = Number(o.mao_obra_adicional ?? 0);
                  const desc = Number(o.desconto ?? 0);
                  // Usa valor_total da tabela (calculado por trigger) — garante que sempre fecha.
                  // Fallback: soma manual.
                  const totalCalculado = servico + pecasCobradas + adic - desc;
                  const total = Number(o.valor_total ?? totalCalculado ?? 0);
                  const sinal = Number(o.sinal_pago ?? 0);
                  const aRec = Math.max(0, total - sinal);
                  if (total <= 0 && sinal <= 0 && servico <= 0 && pecasCobradas <= 0) return null;
                  return (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Orçamento</p>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Serviço (mão de obra)</span><span className="font-medium">{brl(servico)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Peças cobradas ao cliente</span><span className="font-medium">{brl(pecasCobradas)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Mão de obra adicional</span><span className="font-medium">{brl(adic)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Desconto</span><span className={desc > 0 ? "font-medium text-destructive" : "font-medium"}>{desc > 0 ? `− ${brl(desc)}` : brl(0)}</span></div>
                      <div className="border-t border-primary/20 pt-1.5 mt-1.5 flex justify-between text-sm font-bold"><span>TOTAL</span><span className="text-success">{brl(total)}</span></div>
                      {sinal > 0 && (
                        <>
                          <div className="flex justify-between text-xs pt-1"><span className="text-muted-foreground">Sinal pago{o.forma_pagamento_sinal ? ` (${o.forma_pagamento_sinal})` : ""}</span><span className="font-medium text-success">− {brl(sinal)}</span></div>
                          <div className="flex justify-between text-sm font-semibold border-t border-primary/20 pt-1.5 mt-1"><span>A receber na retirada</span><span className="text-primary">{brl(aRec)}</span></div>
                        </>
                      )}
                      {o.garantia_dias != null && (
                        <p className="text-[10px] text-muted-foreground pt-1.5 border-t border-primary/20">Garantia do serviço: {o.garantia_dias} dias</p>
                      )}
                    </div>
                  );
                })()}

                {/* Resultado financeiro (custo médio + comissão tipada) — visível só p/ Admin/Financeiro */}
                <ResultadoFinanceiroOS
                  ordem={ordem}
                  totalDespesasVinculadas={despesasOS.reduce((s, d) => s + Number(d.valor), 0)}
                  totalComissoesReais={comissoesOS.reduce((s, c) => s + Number(c.valor), 0)}
                  qtdPecasUtilizadas={pecasUtilizadas.length}
                  qtdComissoes={comissoesOS.length}
                />

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
                            {pecasDisponiveis.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome_personalizado || p.sku || "Peça"} — {p.quantidade} em estoque — R$ {Number(p.custo_medio ?? p.custo_unitario ?? 0).toFixed(2)}
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
                      {pecasUtilizadas.map((pu) => {
                        const pecaHistorica = (pu as any).estoque_itens;
                        const pecaInativa = pecaHistorica?.ativo === false || !!pecaHistorica?.deleted_at;
                        return (
                        <div key={pu.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">
                              {pecaHistorica?.nome_personalizado || pecaHistorica?.sku || "Peça"}
                              {pecaInativa && <Badge variant="outline" className="ml-2 text-[10px]">inativa</Badge>}
                            </p>
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
                        );
                      })}
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
                  {(() => {
                    const statusAtual = ordem.status;
                    const osCancelada = statusAtual === "cancelado";

                    if (osCancelada) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          OS cancelada · Nenhuma comissão gerada
                        </p>
                      );
                    }

                    if (comissoesOS.length > 0) {
                      return (
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
                      );
                    }

                    return (
                      <div className="rounded-lg border border-dashed border-muted px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Nenhuma comissão gerada para os serviços desta OS
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          As comissões são criadas automaticamente por serviço quando há técnico atribuído ao serviço.
                        </p>
                      </div>
                    );
                  })()}
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
                                  invalidateOrdensDependentes(queryClient);
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

            {/* Conteúdo de impressão (off-screen) */}
            <div style={{ position: "absolute", left: "-10000px", top: 0 }} aria-hidden>
              <ImpressaoOS
                ref={printRef}
                data={{
                  numero: (ordem as any).numero ?? null,
                  numero_formatado: (ordem as any).numero_formatado ?? null,
                  status: ordem.status,
                  data_entrada: ordem.data_entrada,
                  previsao_entrega: ordem.previsao_entrega,
                  defeito_relatado: ordem.defeito_relatado,
                  diagnostico_tecnico: (ordem as any).diagnostico ?? null,
                  obs_cliente: (ordem as any).obs_cliente ?? null,
                  observacoes_internas: (ordem as any).observacoes ?? null,
                  servico_descricao: (ordem as any).servico_realizado ?? null,
                  valor: ordem.valor,
                  valor_total: (ordem as any).valor_total ?? null,
                  desconto: (ordem as any).desconto ?? null,
                  sinal_pago: (ordem as any).sinal_pago ?? null,
                  forma_pagamento_sinal: (ordem as any).forma_pagamento_sinal ?? null,
                  garantia_dias: (ordem as any).garantia_dias ?? 90,
                  mao_obra_adicional: (ordem as any).mao_obra_adicional ?? null,
                  acessorios: (ordem as any).acessorios ?? null,
                  senha_padrao: (ordem as any).senha_padrao ?? null,
                  checklist_entrada: (ordem as any).checklist_entrada ?? null,
                  cliente: {
                    nome: ordem.aparelhos?.clientes?.nome ?? "—",
                    telefone: ordem.aparelhos?.clientes?.telefone ?? "",
                    cpf: (ordem.aparelhos?.clientes as any)?.cpf ?? null,
                    email: (ordem.aparelhos?.clientes as any)?.email ?? null,
                  },
                  aparelho: {
                    marca: ordem.aparelhos?.marca ?? "",
                    modelo: ordem.aparelhos?.modelo ?? "",
                    cor: ordem.aparelhos?.cor ?? null,
                    capacidade: ordem.aparelhos?.capacidade ?? null,
                    imei: ordem.aparelhos?.imei ?? null,
                  },
                  empresa: empresaImpressao
                    ? {
                        nome: (empresaImpressao as any).nome ?? "",
                        cnpj: (empresaImpressao as any).cnpj_cpf ?? null,
                        telefone: (empresaImpressao as any).telefone ?? null,
                        email: (empresaImpressao as any).email ?? null,
                        endereco: (empresaImpressao as any).endereco ?? null,
                        cidade: (empresaImpressao as any).cidade ?? null,
                        estado: (empresaImpressao as any).estado ?? null,
                        logo_url: (empresaImpressao as any).logo_url ?? null,
                      }
                    : null,
                  pecas: (pecasUtilizadas as any[]).map((p) => ({
                    nome: p.estoque?.nome ?? "Peça",
                    quantidade: p.quantidade ?? 1,
                    valor: p.custo_unitario ?? 0,
                  })),
                  tecnico_nome: ordem.tecnico ?? null,
                }}
              />
            </div>
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

      {/* Cancelamento — fluxo dedicado (separado do dropdown de status) */}
      {ordem && (
        <CancelarOSDialog
          ordemId={cancelOpen ? ordem.id : null}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            queryClient.invalidateQueries({ queryKey: ["ordem", orderId] });
            queryClient.invalidateQueries({ queryKey: ["os_auditoria", orderId] });
            invalidateOrdensDependentes(queryClient);
            setCancelOpen(false);
          }}
        />
      )}

      {/* Warning de pulo de fluxo */}
      <AlertDialog open={!!pendingStatusChange} onOpenChange={(o) => { if (!o) setPendingStatusChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pulo de fluxo detectado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Você está mudando para <strong>{pendingStatusChange ? statusLabels[pendingStatusChange.novo] : ""}</strong>, mas existem inconsistências:</p>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  {pendingStatusChange?.motivos.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
                <p className="text-xs text-muted-foreground pt-2">Como Administrador, você pode prosseguir mesmo assim. A ação ficará registrada na auditoria.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingStatusChange) return;
                const novo = pendingStatusChange.novo;
                if (novo === "entregue" && ordem) {
                  pedirConfirmacao({
                    orderId: ordem.id,
                    numero: ordem.numero,
                    clienteNome: ordem.aparelhos?.clientes?.nome ?? "—",
                  });
                } else {
                  changeStatus.mutate(novo);
                }
                setPendingStatusChange(null);
              }}
            >
              Prosseguir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning ao remover serviços com comissão (estorno automático via trigger) */}
      <AlertDialog open={removeServicosWarnOpen} onOpenChange={setRemoveServicosWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Remover estes serviços vai estornar comissões
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <ul className="list-disc pl-5 space-y-0.5">
                  {pendingRemovedServicos.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.nome}</span>
                      {" — Comissão: "}
                      <span className="text-foreground">{brl(s.comissao)}</span>
                    </li>
                  ))}
                </ul>
                <p className="pt-1 border-t">
                  <strong>Total a estornar:</strong>{" "}
                  {brl(pendingRemovedServicos.reduce((s, r) => s + r.comissao, 0))}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRemoveServicosWarnOpen(false);
                setPendingRemovedServicos([]);
                setPendingEditPayload(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const { adicionar, remover } = calcDiffServicos();
                if (pendingEditPayload) {
                  editarOSAdmin.mutate({ dados: pendingEditPayload, pulou_fluxo: false });
                } else {
                  setEditing(false);
                }
                if (adicionar.length > 0 || remover.length > 0) {
                  editarServicos.mutate({ adicionar, remover });
                }
                setRemoveServicosWarnOpen(false);
                setPendingRemovedServicos([]);
                setPendingEditPayload(null);
              }}
            >
              Remover e estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning de mudança de valor com comissão já gerada */}
      <AlertDialog open={valorWarningOpen} onOpenChange={setValorWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Esta OS já gerou comissão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Mudar o valor cobrado <strong>não recalcula automaticamente</strong> as comissões já lançadas.
              Para ajustar a comissão, você precisará editá-la manualmente no módulo Financeiro {`>`} Comissões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setValorWarningOpen(false); setPendingEditPayload(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingEditPayload) {
                  editarOSAdmin.mutate({ dados: pendingEditPayload, pulou_fluxo: false });
                }
                setValorWarningOpen(false);
              }}
            >
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drawer Histórico de auditoria */}
      <Sheet open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Histórico de auditoria
            </SheetTitle>
          </SheetHeader>
          {historicoAuditoria.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento de auditoria registrado.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {(historicoAuditoria as any[]).map((h) => (
                <div key={h.id} className="rounded-lg border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.acao}</Badge>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p>
                    <span className="text-muted-foreground">Por:</span>{" "}
                    <span className="font-medium">{h.realizada_por_nome || "—"}</span>
                    {h.realizada_por_role ? <span className="text-muted-foreground"> ({h.realizada_por_role})</span> : null}
                  </p>
                  {h.motivo && (
                    <p><span className="text-muted-foreground">Motivo:</span> {h.motivo}</p>
                  )}
                  {h.payload?.campos_alterados && Array.isArray(h.payload.campos_alterados) && (
                    <p>
                      <span className="text-muted-foreground">Campos:</span>{" "}
                      <span className="font-mono text-[10px]">{h.payload.campos_alterados.join(", ")}</span>
                    </p>
                  )}
                  {h.payload?.pulou_fluxo && (
                    <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30 text-[10px] gap-1">
                      <AlertTriangle className="h-3 w-3" />Pulo de fluxo
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
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
