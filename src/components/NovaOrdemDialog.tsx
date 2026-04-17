import { useState, useRef, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, UserPlus, CalendarIcon, Smartphone, Search,
  CheckCircle2, AlertCircle, XCircle, ChevronRight,
  User, Wrench, ClipboardList, X, Plus, Minus, Package, Printer,
  History, BatteryMedium, Power, MessageCircle, Phone, Mail,
} from "lucide-react";
import { luhnValid } from "@/lib/luhn";
import { lookupCep, maskCep } from "@/lib/cep";
import { formatCpfCnpj, onlyDigits, isValidCpfCnpj } from "@/lib/cpfCnpj";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { EtiquetaOS } from "@/components/EtiquetaOS";
import { ComboboxWithCreate } from "@/components/smart-inputs/ComboboxWithCreate";
import { ChecklistEntrada, type ChecklistStatus } from "@/components/ChecklistEntrada";
import { Link } from "react-router-dom";

type Status = Database["public"]["Enums"]["status_ordem"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedClientId?: string | null;
}

type ImeiStatus = "idle" | "loading" | "found" | "partial" | "not_found" | "error" | "duplicate";

interface ImeiResult {
  status: ImeiStatus;
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  message?: string;
  duplicate?: { table: string; info: string } | null;
}

type Step = "cliente" | "aparelho" | "servico" | "sucesso";

const STEPS: { key: Step; label: string; icon: typeof User }[] = [
  { key: "cliente",  label: "Cliente",  icon: User },
  { key: "aparelho", label: "Aparelho", icon: Smartphone },
  { key: "servico",  label: "Serviço",  icon: Wrench },
];

interface DefeitoSelecionado {
  id: string;
  nome: string;
  categoria: string;
  valor_mao_obra: number;
  comissao_padrao: number;
}

interface PecaSelecionada {
  id: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  estoque_disponivel: number;
  // IDs dos serviços que adicionaram esta peça automaticamente.
  // Vazio = peça adicionada manualmente.
  origens: string[];
}

export function NovaOrdemDialog({ open, onOpenChange, onSuccess, preSelectedClientId }: Props) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("cliente");

  // Cliente
  const [showNewClient, setShowNewClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientNome, setNewClientNome] = useState("");
  const [newClientTelefone, setNewClientTelefone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCpfCnpj, setNewClientCpfCnpj] = useState("");
  const [newClientNascimento, setNewClientNascimento] = useState<Date | undefined>();
  const [newClientCep, setNewClientCep] = useState("");
  const [newClientRua, setNewClientRua] = useState("");
  const [newClientNumero, setNewClientNumero] = useState("");
  const [newClientComplemento, setNewClientComplemento] = useState("");
  const [newClientBairro, setNewClientBairro] = useState("");
  const [newClientCidade, setNewClientCidade] = useState("");
  const [newClientEstado, setNewClientEstado] = useState("");
  const [newClientOrigem, setNewClientOrigem] = useState("");
  const [newClientObs, setNewClientObs] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  // Resultado de busca por IMEI (15 dígitos no campo busca)
  const [imeiSearchHits, setImeiSearchHits] = useState<Array<{ cliente_id: string; cliente_nome: string; cliente_telefone: string; aparelho_label: string; numero_os?: string | null }>>([]);

  // Aparelho
  const [imei, setImei] = useState("");
  const [imei2, setImei2] = useState("");
  const [imeiResult, setImeiResult] = useState<ImeiResult>({ status: "idle" });
  const [aparelhoExistente, setAparelhoExistente] = useState<{ id: string; cliente_id: string; cliente_nome: string; total_os: number; mesmo_cliente: boolean } | null>(null);
  const [marca, setMarca] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [modelo, setModelo] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [cor, setCor] = useState("");
  const [corId, setCorId] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [capacidadeId, setCapacidadeId] = useState("");
  const [senhaDesbloqueio, setSenhaDesbloqueio] = useState("");
  const [acessorios, setAcessorios] = useState("");
  // Estado de recebimento
  const [liga, setLiga] = useState<"sim" | "nao" | "parcial">("sim");
  const [bateriaEntrada, setBateriaEntrada] = useState("");
  const [estadoGeral, setEstadoGeral] = useState("");

  // Serviço — defeitos
  const [defeitoSearch, setDefeitoSearch] = useState("");
  const [defeitosFocused, setDefeitosFocused] = useState(false);
  const [defeitosSelecionados, setDefeitosSelecionados] = useState<DefeitoSelecionado[]>([]);

  // Serviço — peças
  const [pecaSearch, setPecaSearch] = useState("");
  const [pecasFocused, setPecasFocused] = useState(false);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<PecaSelecionada[]>([]);

  // Serviço — outros
  const [maoObraAdicional, setMaoObraAdicional] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [obsCliente, setObsCliente] = useState("");
  const [relatoCliente, setRelatoCliente] = useState("");
  const [contatoPreferido, setContatoPreferido] = useState<"whatsapp" | "ligacao" | "sms" | "email">("whatsapp");
  const [aprovadoNoAto, setAprovadoNoAto] = useState(false);
  const [tecnico, setTecnico] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState<Date | undefined>();
  const [previsaoHora, setPrevisaoHora] = useState("18:00");
  const [checklist, setChecklist] = useState<Record<string, ChecklistStatus>>({});
  const [checklistCustom, setChecklistCustom] = useState<{ key: string; label: string }[]>([]);
  const [createdOS, setCreatedOS] = useState<{ numero: number; id: string } | null>(null);
  const [lojistaId, setLojistaId] = useState("");

  // Financeiro
  const [desconto, setDesconto] = useState("");
  const [sinalPago, setSinalPago] = useState("");
  const [formaPagamentoSinal, setFormaPagamentoSinal] = useState("nenhum");
  const [orcamentoStatus, setOrcamentoStatus] = useState<"aguardando" | "aprovado" | "recusado">("aguardando");
  const [garantiaDias, setGarantiaDias] = useState("90");

  const imeiRef = useRef<HTMLInputElement>(null);

  // Auto-set previsão when entering step servico (default: hoje + 3 dias úteis às 18:00)
  useEffect(() => {
    if (step === "servico" && !previsaoEntrega) {
      let d = new Date();
      let added = 0;
      while (added < 3) {
        d = addDays(d, 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      setPrevisaoEntrega(d);
      setPrevisaoHora("18:00");
    }
  }, [step]);

  // Pre-select client when prop changes
  useEffect(() => {
    if (preSelectedClientId && open) {
      setSelectedClientId(preSelectedClientId);
    }
  }, [preSelectedClientId, open]);

  // ── Queries ──
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: lojistasAtivos = [] } = useQuery({
    queryKey: ["lojistas-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("lojistas").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: tiposDefeito = [] } = useQuery<any[]>({
    queryKey: ["tipos_servico_os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico")
        .select("id, nome, categoria, valor_padrao, ativo")
        .eq("ativo", true)
        .order("categoria", { nullsFirst: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        categoria: s.categoria || "geral",
        valor_mao_obra: Number(s.valor_padrao) || 0,
      }));
    },
  });

  const { data: pecasEstoque = [] } = useQuery({
    queryKey: ["estoque_pecas_para_os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("*, estoque_categorias:categoria_id ( nome ), marcas:marca_id ( nome ), modelos:modelo_id ( nome )")
        .eq("tipo_item", "peca")
        .is("deleted_at", null)
        .order("nome_personalizado");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Vínculos serviço→peças (carregado uma vez)
  const { data: vinculosServicoPecas = [] } = useQuery({
    queryKey: ["servico_pecas_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servico_pecas" as any)
        .select("servico_id, peca_id, quantidade, obrigatoria");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ servico_id: string; peca_id: string; quantidade: number; obrigatoria: boolean }>;
    },
  });

  const queryClientRef = queryClient;

  const { data: marcasList = [] } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: modelosList = [] } = useQuery({
    queryKey: ["modelos"],
    queryFn: async () => {
      const { data } = await supabase.from("modelos").select("id, nome, marca_id").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: coresList = [] } = useQuery({
    queryKey: ["cores"],
    queryFn: async () => {
      const { data } = await supabase.from("cores").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: capacidadesList = [] } = useQuery({
    queryKey: ["capacidades"],
    queryFn: async () => {
      const { data } = await supabase.from("capacidades").select("id, nome, ordem").eq("ativo", true).order("ordem").order("nome");
      return data ?? [];
    },
  });

  const { data: tecnicosList = [] } = useQuery({
    queryKey: ["tecnicos-os"],
    queryFn: async () => {
      const { data } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      return data ?? [];
    },
  });

  const modelosFiltrados = useMemo(
    () => marcaId ? modelosList.filter((m: any) => m.marca_id === marcaId) : modelosList,
    [modelosList, marcaId]
  );

  async function createMarca(nome: string) {
    const { data, error } = await supabase.from("marcas").insert({ nome }).select("id, nome").single();
    if (error) throw error;
    queryClientRef.invalidateQueries({ queryKey: ["marcas"] });
    return data;
  }
  async function createModelo(nome: string) {
    if (!marcaId) return null;
    const { data, error } = await supabase.from("modelos").insert({ nome, marca_id: marcaId }).select("id, nome").single();
    if (error) throw error;
    queryClientRef.invalidateQueries({ queryKey: ["modelos"] });
    return data;
  }
  async function createCor(nome: string) {
    const { data, error } = await supabase.from("cores").insert({ nome }).select("id, nome").single();
    if (error) throw error;
    queryClientRef.invalidateQueries({ queryKey: ["cores"] });
    return data;
  }
  async function createCapacidade(nome: string) {
    const { data, error } = await supabase.from("capacidades").insert({ nome }).select("id, nome").single();
    if (error) throw error;
    queryClientRef.invalidateQueries({ queryKey: ["capacidades"] });
    return data;
  }

  // ── Derived ──
  const searchDigits = clientSearch.replace(/\D/g, "");
  const isImeiSearch = /^\d{15}$/.test(searchDigits);
  const isDocSearch = searchDigits.length >= 11;

  const clientesFiltrados = clientes.filter((c) => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    if (c.nome.toLowerCase().includes(q)) return true;
    if ((c.telefone || "").includes(searchDigits || clientSearch)) return true;
    // CPF/CNPJ pode estar em `cpf` ou `documento`
    const docs = [c.cpf, c.documento].filter(Boolean) as string[];
    if (searchDigits.length >= 3 && docs.some(d => d.replace(/\D/g, "").includes(searchDigits))) return true;
    return false;
  });
  const clienteSelecionado = clientes.find((c) => c.id === selectedClientId);

  // Busca por IMEI (15 dígitos) — busca o cliente dono do aparelho
  useEffect(() => {
    if (!isImeiSearch) {
      setImeiSearchHits([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo, cliente_id, clientes(nome, telefone)")
        .eq("imei", searchDigits)
        .limit(5);
      if (cancelled || !data) return;
      // Pegar última OS de cada aparelho para mostrar referência
      const aparelhoIds = data.map(d => d.id);
      const { data: osData } = aparelhoIds.length
        ? await supabase
            .from("ordens_de_servico")
            .select("aparelho_id, numero_formatado, numero")
            .in("aparelho_id", aparelhoIds)
            .order("created_at", { ascending: false })
        : { data: [] as any[] };
      const lastOsByApar = new Map<string, string | null>();
      (osData || []).forEach((o: any) => {
        if (!lastOsByApar.has(o.aparelho_id)) {
          lastOsByApar.set(o.aparelho_id, o.numero_formatado || (o.numero ? String(o.numero).padStart(3, "0") : null));
        }
      });
      setImeiSearchHits(
        data.map((d: any) => ({
          cliente_id: d.cliente_id,
          cliente_nome: d.clientes?.nome ?? "Cliente",
          cliente_telefone: d.clientes?.telefone ?? "",
          aparelho_label: `${d.marca || ""} ${d.modelo || ""}`.trim() || "Aparelho",
          numero_os: lastOsByApar.get(d.id) || null,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [isImeiSearch, searchDigits]);

  // Detecção de aparelho cadastrado ao digitar IMEI no passo 2
  useEffect(() => {
    if (imei.length !== 15) {
      setAparelhoExistente(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("aparelhos")
        .select("id, cliente_id, clientes(nome)")
        .eq("imei", imei)
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) {
        setAparelhoExistente(null);
        return;
      }
      const { count } = await supabase
        .from("ordens_de_servico")
        .select("id", { count: "exact", head: true })
        .eq("aparelho_id", data.id)
        .is("deleted_at", null);
      setAparelhoExistente({
        id: data.id,
        cliente_id: data.cliente_id,
        cliente_nome: (data as any).clientes?.nome ?? "outro cliente",
        total_os: count || 0,
        mesmo_cliente: data.cliente_id === selectedClientId,
      });
    })();
    return () => { cancelled = true; };
  }, [imei, selectedClientId]);

  // Auto-fill via ViaCEP
  useEffect(() => {
    const digits = newClientCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    lookupCep(digits).then((data) => {
      if (cancelled) return;
      setCepLoading(false);
      if (!data) return;
      if (!newClientRua) setNewClientRua(data.logradouro || "");
      if (!newClientBairro) setNewClientBairro(data.bairro || "");
      if (!newClientCidade) setNewClientCidade(data.localidade || "");
      if (!newClientEstado) setNewClientEstado(data.uf || "");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newClientCep]);

  // Validação Luhn (apenas para warning visual)
  const imeiLuhnOk = imei.length === 15 ? luhnValid(imei) : null;
  const imei2LuhnOk = imei2.length === 15 ? luhnValid(imei2) : null;

  const defeitosFiltrados = useMemo(() => {
    const selectedIds = new Set(defeitosSelecionados.map(d => d.id));
    return tiposDefeito.filter(d =>
      !selectedIds.has(d.id) &&
      (!defeitoSearch || d.nome.toLowerCase().includes(defeitoSearch.toLowerCase()) || d.categoria.toLowerCase().includes(defeitoSearch.toLowerCase()))
    );
  }, [tiposDefeito, defeitoSearch, defeitosSelecionados]);

  const pecasFiltradas = useMemo(() => {
    const selectedIds = new Set(pecasSelecionadas.map(p => p.id));
    return pecasEstoque.filter(p =>
      !selectedIds.has(p.id) &&
      (!pecaSearch ||
        (p.nome_personalizado || "").toLowerCase().includes(pecaSearch.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(pecaSearch.toLowerCase()))
    );
  }, [pecasEstoque, pecaSearch, pecasSelecionadas]);

  // ── Valores calculados ──
  const totalMaoObraDefeitos = defeitosSelecionados.reduce((s, d) => s + d.valor_mao_obra, 0);
  const totalPecas = pecasSelecionadas.reduce((s, p) => s + p.preco_venda * p.quantidade, 0);
  const custoPecas = pecasSelecionadas.reduce((s, p) => s + p.custo_unitario * p.quantidade, 0);
  const adicional = parseFloat(maoObraAdicional) || 0;
  const descontoNum = Math.max(0, parseFloat(desconto) || 0);
  const sinalPagoNum = Math.max(0, parseFloat(sinalPago) || 0);
  const garantiaDiasNum = Math.max(0, parseInt(garantiaDias, 10) || 0);
  const subtotal = totalMaoObraDefeitos + totalPecas + adicional;
  const valorTotal = Math.max(0, subtotal - descontoNum);
  const aReceber = Math.max(0, valorTotal - sinalPagoNum);

  const defeitosNomes = defeitosSelecionados.map(d => d.nome).join("; ");
  // Campo `defeito_relatado` da OS recebe o relato (texto livre) ou os nomes dos defeitos
  const defeitoRelatado = relatoCliente.trim() || defeitosNomes;

  // ── Sincronização Serviço → Peças vinculadas ──
  // Quando um serviço é selecionado/removido, ajustar peças "auto" automaticamente.
  // Tracking via array `origens` em cada peça (IDs dos serviços que a adicionaram).
  const servicosIds = useMemo(() => defeitosSelecionados.map(d => d.id).join(","), [defeitosSelecionados]);
  useEffect(() => {
    if (vinculosServicoPecas.length === 0) return;
    const servicosSelecionadosSet = new Set(defeitosSelecionados.map(d => d.id));

    setPecasSelecionadas(prev => {
      // Mapa: peca_id → { quantidade somada, origens (servicos obrigatórios) }
      const autoMap = new Map<string, { qtd: number; origens: Set<string> }>();
      for (const v of vinculosServicoPecas) {
        if (!servicosSelecionadosSet.has(v.servico_id)) continue;
        if (!v.obrigatoria) continue; // não-obrigatórias não auto-adicionam
        const cur = autoMap.get(v.peca_id) ?? { qtd: 0, origens: new Set<string>() };
        cur.qtd += Number(v.quantidade) || 1;
        cur.origens.add(v.servico_id);
        autoMap.set(v.peca_id, cur);
      }

      const result: PecaSelecionada[] = [];

      // 1) Atualizar/manter peças existentes
      for (const peca of prev) {
        const auto = autoMap.get(peca.id);
        const origensManuais = peca.origens.filter(o => servicosSelecionadosSet.has(o));
        const eraSomenteAuto = peca.origens.length > 0 && origensManuais.length === peca.origens.length;

        if (auto) {
          // Peça é auto-adicionada por algum serviço atual
          // Quantidade = parte manual conservada + auto.qtd (se já era auto antes, mantém apenas auto.qtd)
          const partManual = peca.origens.length === 0 ? peca.quantidade : 0;
          result.push({
            ...peca,
            quantidade: Math.max(1, partManual + auto.qtd),
            origens: Array.from(auto.origens),
          });
          autoMap.delete(peca.id);
        } else if (peca.origens.length === 0) {
          // Peça manual — mantém intacta
          result.push(peca);
        } else if (eraSomenteAuto) {
          // Veio só de serviços que foram desmarcados → remover
          // (não adiciona ao result)
        } else {
          // Peça tinha origens mas algumas ainda válidas (caso raro pós-state)
          result.push({ ...peca, origens: peca.origens.filter(o => servicosSelecionadosSet.has(o)) });
        }
      }

      // 2) Adicionar peças auto novas
      for (const [peca_id, auto] of autoMap.entries()) {
        const pEstoque = pecasEstoque.find((x: any) => x.id === peca_id);
        if (!pEstoque) continue;
        result.push({
          id: peca_id,
          nome: getPecaNome(pEstoque),
          quantidade: auto.qtd,
          custo_unitario: Number(pEstoque.custo_unitario ?? 0),
          preco_venda: Number(pEstoque.preco_venda ?? 0),
          estoque_disponivel: pEstoque.quantidade,
          origens: Array.from(auto.origens),
        });
      }

      return result;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicosIds, vinculosServicoPecas]);

  // Mapa para mostrar nome do serviço de origem em cada peça auto
  const servicoNomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of defeitosSelecionados) m.set(d.id, d.nome);
    return m;
  }, [defeitosSelecionados]);

  // ── Reset ──
  function resetAll() {
    setStep("cliente");
    setShowNewClient(false);
    setSelectedClientId("");
    setNewClientNome("");
    setNewClientTelefone("");
    setNewClientEmail("");
    setNewClientCpfCnpj("");
    setNewClientNascimento(undefined);
    setNewClientCep("");
    setNewClientRua("");
    setNewClientNumero("");
    setNewClientComplemento("");
    setNewClientBairro("");
    setNewClientCidade("");
    setNewClientEstado("");
    setNewClientOrigem("");
    setNewClientObs("");
    setClientSearch("");
    setImeiSearchHits([]);
    setImei("");
    setImei2("");
    setImeiResult({ status: "idle" });
    setAparelhoExistente(null);
    setMarca(""); setMarcaId("");
    setModelo(""); setModeloId("");
    setCor(""); setCorId("");
    setCapacidade(""); setCapacidadeId("");
    setSenhaDesbloqueio("");
    setAcessorios("");
    setLiga("sim");
    setBateriaEntrada("");
    setEstadoGeral("");
    setDefeitoSearch("");
    setDefeitosSelecionados([]);
    setPecaSearch("");
    setPecasSelecionadas([]);
    setMaoObraAdicional("");
    setObservacoes("");
    setObsCliente("");
    setRelatoCliente("");
    setContatoPreferido("whatsapp");
    setAprovadoNoAto(false);
    setTecnico("");
    setTecnicoId("");
    setLocalizacao("");
    setPrevisaoEntrega(undefined);
    setPrevisaoHora("18:00");
    setChecklist({});
    setChecklistCustom([]);
    setCreatedOS(null);
    setLojistaId("");
    setDesconto("");
    setSinalPago("");
    setFormaPagamentoSinal("nenhum");
    setOrcamentoStatus("aguardando");
    setGarantiaDias("90");
  }

  function handleClose(v: boolean) {
    if (!v) resetAll();
    onOpenChange(v);
  }

  // ── Mutations ──
  const createClientMutation = useMutation({
    mutationFn: async () => {
      const docDigits = onlyDigits(newClientCpfCnpj);
      // Validação leve do CPF/CNPJ se preenchido
      if (docDigits && !isValidCpfCnpj(docDigits)) {
        throw new Error("CPF/CNPJ inválido — confira os dígitos");
      }
      const payload: any = {
        nome: newClientNome,
        telefone: newClientTelefone,
        email: newClientEmail || null,
        cpf: docDigits || null,
        documento: docDigits || null,
        data_nascimento: newClientNascimento ? format(newClientNascimento, "yyyy-MM-dd") : null,
        cep: newClientCep.replace(/\D/g, "") || null,
        rua: newClientRua || null,
        numero_endereco: newClientNumero || null,
        complemento: newClientComplemento || null,
        bairro: newClientBairro || null,
        cidade: newClientCidade || null,
        estado: newClientEstado || null,
        origem: newClientOrigem || null,
        observacoes: newClientObs || null,
      };
      const { data, error } = await supabase
        .from("clientes")
        .insert(payload)
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setSelectedClientId(data.id);
      setShowNewClient(false);
      toast.success("Cliente cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function consultarImei() {
    const digits = imei.replace(/\D/g, "");
    if (digits.length !== 15) {
      toast.error("IMEI deve ter 15 dígitos");
      return;
    }
    setImeiResult({ status: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("imei-lookup", {
        body: { imei: digits },
      });
      if (error) throw error;
      const result = data as ImeiResult & { status: string; duplicate?: { table: string; info: string } | null };
      if (result.status === "error" && result.duplicate) {
        setImeiResult({ status: "duplicate", message: result.message, duplicate: result.duplicate });
        return;
      }
      if (result.status === "error") {
        setImeiResult({ status: "error", message: result.message });
        return;
      }
      if (result.status === "not_found") {
        setImeiResult({ status: "not_found", message: result.message });
        return;
      }
      if (result.marca) {
        setMarca(result.marca);
        const m = marcasList.find((x: any) => x.nome.toLowerCase() === result.marca!.toLowerCase());
        if (m) setMarcaId(m.id);
      }
      if (result.modelo) {
        setModelo(result.modelo);
        const m = modelosList.find((x: any) => x.nome.toLowerCase() === result.modelo!.toLowerCase());
        if (m) setModeloId(m.id);
      }
      if (result.cor) {
        setCor(result.cor);
        const c = coresList.find((x: any) => x.nome.toLowerCase() === result.cor!.toLowerCase());
        if (c) setCorId(c.id);
      }
      if (result.capacidade) {
        setCapacidade(result.capacidade);
        const c = capacidadesList.find((x: any) => x.nome.toLowerCase() === result.capacidade!.toLowerCase());
        if (c) setCapacidadeId(c.id);
      }
      setImeiResult({
        status: result.status as ImeiStatus,
        marca: result.marca,
        modelo: result.modelo,
        cor: result.cor,
        capacidade: result.capacidade,
      });
      toast.success(`Aparelho identificado: ${result.marca} ${result.modelo}`);
    } catch {
      setImeiResult({ status: "error", message: "Erro ao consultar IMEI" });
      toast.error("Erro ao consultar IMEI");
    }
  }

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("Selecione um cliente");
      if (!marca || !modelo) throw new Error("Marca e modelo são obrigatórios");
      if (defeitosSelecionados.length === 0 && !relatoCliente.trim()) {
        throw new Error("Informe o relato do cliente ou selecione ao menos um serviço");
      }

      // 1. Aparelho — reusa se IMEI já existe e é do mesmo cliente
      let aparelhoId: string;
      if (aparelhoExistente && aparelhoExistente.mesmo_cliente) {
        aparelhoId = aparelhoExistente.id;
      } else {
        const { data: aparelho, error: apErr } = await supabase
          .from("aparelhos")
          .insert({
            cliente_id: selectedClientId,
            marca, modelo,
            cor: cor || null,
            capacidade: capacidade || null,
            imei: imei.replace(/\D/g, "") || null,
            marca_id: marcaId || null,
            modelo_id: modeloId || null,
            cor_id: corId || null,
            capacidade_id: capacidadeId || null,
            observacoes: imei2 ? `IMEI 2: ${imei2}` : null,
          } as any)
          .select().single();
        if (apErr) throw apErr;
        aparelhoId = aparelho.id;
      }

      // Status final depende do "Aprovado no ato"
      const finalAprovacao = aprovadoNoAto ? "aprovado" : orcamentoStatus;

      // 2. Criar OS
      const { data: ordem, error: osErr } = await supabase.from("ordens_de_servico").insert({
        aparelho_id: aparelhoId,
        defeito_relatado: defeitoRelatado,
        relato_cliente: relatoCliente || null,
        observacoes: observacoes || null,
        valor: valorTotal || null,
        valor_total: valorTotal || null,
        custo_pecas: custoPecas || 0,
        mao_obra_adicional: adicional || 0,
        desconto: descontoNum || 0,
        sinal_pago: sinalPagoNum || 0,
        valor_pago: sinalPagoNum || 0,
        valor_pendente: aReceber,
        forma_pagamento_sinal: sinalPagoNum > 0 && formaPagamentoSinal !== "nenhum" ? formaPagamentoSinal : null,
        garantia_dias: garantiaDiasNum,
        aprovacao_orcamento: finalAprovacao,
        aprovado_no_ato: aprovadoNoAto,
        data_aprovacao: finalAprovacao === "aprovado" ? new Date().toISOString() : null,
        data_entrada: new Date().toISOString(),
        tecnico: tecnico || null,
        funcionario_id: tecnicoId || null,
        obs_cliente: obsCliente || null,
        liga,
        bateria_entrada: bateriaEntrada ? Math.max(0, Math.min(100, parseInt(bateriaEntrada, 10))) : null,
        estado_geral: estadoGeral || null,
        imei2: imei2.replace(/\D/g, "") || null,
        contato_preferido: contatoPreferido,
        checklist_entrada: Object.keys(checklist).length > 0 || checklistCustom.length > 0
          ? { itens: checklist, custom: checklistCustom }
          : null,
        previsao_entrega: previsaoEntrega
          ? (() => {
              const [hh, mm] = (previsaoHora || "18:00").split(":").map(Number);
              const d = new Date(previsaoEntrega);
              d.setHours(hh || 18, mm || 0, 0, 0);
              return d.toISOString();
            })()
          : null,
        status: "recebido" as Status,
        lojista_id: lojistaId || null,
      } as any).select("id, numero, numero_formatado").single();
      if (osErr) throw osErr;

      // 3. Inserir os_servicos (N:N) — com snapshot de comissão do serviço
      if (defeitosSelecionados.length > 0) {
        const { error: defErr } = await supabase.from("os_servicos").insert(
          defeitosSelecionados.map(d => ({
            ordem_id: ordem.id,
            servico_id: d.id,
            nome: d.nome,
            valor: d.valor_mao_obra,
            categoria: d.categoria,
            comissao: d.comissao_padrao || 0,
          })) as any
        );
        if (defErr) throw defErr;
      }

      // 4. Inserir pecas_utilizadas — com preço cobrado e origem (serviço auto vs avulsa)
      if (pecasSelecionadas.length > 0) {
        const { error: pecErr } = await supabase.from("pecas_utilizadas").insert(
          pecasSelecionadas.map(p => ({
            ordem_id: ordem.id,
            peca_id: p.id,
            quantidade: p.quantidade,
            custo_unitario: p.custo_unitario,
            preco_unitario: p.preco_venda,
            // Se a peça veio de algum serviço, gravar o primeiro como origem
            origem_servico_id: p.origens.length > 0 ? p.origens[0] : null,
          })) as any
        );
        if (pecErr) throw pecErr;
      }

      return ordem;
    },
    onSuccess: (ordem: any) => {
      const labelNum = ordem?.numero_formatado || String(ordem?.numero || 0).padStart(3, "0");
      toast.success(`OS #${labelNum} criada!`);
      queryClient.invalidateQueries({ queryKey: ["estoque_pecas_para_os"] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setCreatedOS(ordem ? { numero: ordem.numero, id: ordem.id } : null);
      setStep("sucesso");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Validação ──
  const canAdvanceCliente = !!selectedClientId;
  const canAdvanceAparelho = !!marca && !!modelo;
  const canSubmit = canAdvanceCliente && canAdvanceAparelho && (defeitosSelecionados.length > 0 || !!relatoCliente.trim());

  // ── Helpers peças ──
  function getPecaNome(p: typeof pecasEstoque[number]) {
    if (p.nome_personalizado) return p.nome_personalizado;
    const marcaNome = (p as any).marcas?.nome || "";
    const modeloNome = (p as any).modelos?.nome || "";
    return [marcaNome, modeloNome].filter(Boolean).join(" ") || `Peça ${p.sku || p.id.slice(0, 6)}`;
  }

  function addPeca(p: typeof pecasEstoque[number]) {
    setPecasSelecionadas(prev => [...prev, {
      id: p.id,
      nome: getPecaNome(p),
      quantidade: 1,
      custo_unitario: Number(p.custo_unitario ?? 0),
      preco_venda: Number(p.preco_venda ?? 0),
      estoque_disponivel: p.quantidade,
      origens: [],
    }]);
    setPecaSearch("");
  }

  function updatePecaQtd(id: string, delta: number) {
    setPecasSelecionadas(prev => prev.map(p => {
      if (p.id !== id) return p;
      // Permitir quantidade > estoque (com warning visual depois)
      const novoMax = Math.max(p.estoque_disponivel, p.quantidade + delta);
      const newQtd = Math.max(1, Math.min(novoMax, p.quantidade + delta));
      return { ...p, quantidade: newQtd };
    }));
  }

  function removePeca(id: string) {
    // Remove peça mesmo que tenha vindo de um serviço (técnico decide)
    setPecasSelecionadas(prev => prev.filter(p => p.id !== id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">

        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" />
            Nova Ordem de Serviço
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 px-5 py-3 border-b bg-muted/30">
          {STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isDone =
              (s.key === "cliente" && canAdvanceCliente && step !== "cliente") ||
              (s.key === "aparelho" && canAdvanceAparelho && step === "servico");
            return (
              <div key={s.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (s.key === "aparelho" && !canAdvanceCliente) return;
                    if (s.key === "servico" && !canAdvanceAparelho) return;
                    setStep(s.key);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium transition-colors px-1 py-0.5 rounded",
                    isActive ? "text-primary" : isDone ? "text-green-600" : "text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="flex items-center justify-center h-4 w-4 rounded-full border text-[10px]">
                      {i + 1}
                    </span>
                  )}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-5 pt-3 space-y-4">

          {/* ═══ STEP 1 — CLIENTE ═══ */}
          {step === "cliente" && (
            <div className="space-y-3">
              {!showNewClient ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome, telefone, CPF/CNPJ ou IMEI (15 dígitos)..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                    {isImeiSearch && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-primary font-medium">
                        Buscando por IMEI
                      </span>
                    )}
                  </div>

                  {/* Hits via IMEI */}
                  {isImeiSearch && imeiSearchHits.length > 0 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 divide-y divide-primary/20">
                      {imeiSearchHits.map((hit) => (
                        <button
                          key={`${hit.cliente_id}-${hit.aparelho_label}`}
                          type="button"
                          onClick={() => setSelectedClientId(hit.cliente_id)}
                          className={cn(
                            "w-full px-3 py-2.5 text-left text-sm hover:bg-primary/10 transition-colors",
                            selectedClientId === hit.cliente_id && "bg-primary/10"
                          )}
                        >
                          <p className="font-medium text-sm">{hit.cliente_nome} — {hit.cliente_telefone}</p>
                          <p className="text-[11px] text-primary mt-0.5">
                            ↳ Encontrado pelo IMEI do {hit.aparelho_label}
                            {hit.numero_os ? ` (OS #${hit.numero_os})` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                    {clientesFiltrados.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-6">Nenhum cliente encontrado</p>
                    ) : (
                      clientesFiltrados.map((c) => (
                        <button
                          key={c.id} type="button"
                          onClick={() => setSelectedClientId(c.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                            selectedClientId === c.id && "bg-primary/5 border-l-2 border-l-primary"
                          )}
                        >
                          <div>
                            <p className="font-medium text-sm">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.telefone}
                              {(c.cpf || c.documento) && (
                                <span className="ml-2">· {formatCpfCnpj(c.cpf || c.documento || "")}</span>
                              )}
                            </p>
                          </div>
                          {selectedClientId === c.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </button>
                      ))
                    )}
                  </div>
                  <button type="button" onClick={() => setShowNewClient(true)} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar novo cliente
                  </button>
                </>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                  <p className="text-sm font-semibold">Novo cliente</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Nome completo *</Label>
                      <Input value={newClientNome} onChange={(e) => setNewClientNome(e.target.value)} placeholder="João Silva" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone / WhatsApp *</Label>
                      <Input value={newClientTelefone} onChange={(e) => setNewClientTelefone(e.target.value)} placeholder="(19) 99999-9999" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="opcional" className="mt-1 h-8 text-sm" type="email" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
                      <Input
                        value={formatCpfCnpj(newClientCpfCnpj)}
                        onChange={(e) => setNewClientCpfCnpj(onlyDigits(e.target.value))}
                        placeholder="opcional"
                        className="mt-1 h-8 text-sm font-mono"
                        inputMode="numeric"
                      />
                      {newClientCpfCnpj && !isValidCpfCnpj(newClientCpfCnpj) && (newClientCpfCnpj.length === 11 || newClientCpfCnpj.length === 14) && (
                        <p className="text-[10px] text-destructive mt-0.5">Dígitos inválidos</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de nascimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("mt-1 h-8 w-full justify-start text-left font-normal text-sm", !newClientNascimento && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {newClientNascimento ? format(newClientNascimento, "dd/MM/yyyy", { locale: ptBR }) : "opcional"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newClientNascimento}
                            onSelect={setNewClientNascimento}
                            captionLayout="dropdown-buttons"
                            fromYear={1920}
                            toYear={new Date().getFullYear()}
                            disabled={(d) => d > new Date()}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <div className="relative mt-1">
                        <Input
                          value={maskCep(newClientCep)}
                          onChange={(e) => setNewClientCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          placeholder="00000-000"
                          className="h-8 text-sm font-mono pr-7"
                          inputMode="numeric"
                        />
                        {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Rua</Label>
                        <Input value={newClientRua} onChange={(e) => setNewClientRua(e.target.value)} className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Número</Label>
                        <Input value={newClientNumero} onChange={(e) => setNewClientNumero(e.target.value)} className="mt-1 h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Complemento</Label>
                      <Input value={newClientComplemento} onChange={(e) => setNewClientComplemento(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <Input value={newClientBairro} onChange={(e) => setNewClientBairro(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <Input value={newClientCidade} onChange={(e) => setNewClientCidade(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">UF</Label>
                      <Input value={newClientEstado} onChange={(e) => setNewClientEstado(e.target.value.toUpperCase().slice(0, 2))} className="mt-1 h-8 text-sm uppercase" maxLength={2} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Como nos conheceu?</Label>
                      <select
                        value={newClientOrigem}
                        onChange={(e) => setNewClientOrigem(e.target.value)}
                        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">— opcional —</option>
                        <option value="indicacao">Indicação</option>
                        <option value="google">Google</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="passando">Passando na rua</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <Textarea
                        value={newClientObs}
                        onChange={(e) => setNewClientObs(e.target.value)}
                        rows={2}
                        className="mt-1 resize-none text-sm"
                        placeholder="opcional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!newClientNome || !newClientTelefone || createClientMutation.isPending} onClick={() => createClientMutation.mutate()}>
                      {createClientMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
                      Cadastrar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewClient(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {clienteSelecionado && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-primary/5">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{clienteSelecionado.nome}</p>
                    <p className="text-xs text-muted-foreground">{clienteSelecionado.telefone}</p>
                  </div>
                </div>
              )}

              <Button className="w-full" disabled={!canAdvanceCliente} onClick={() => setStep("aparelho")}>
                Próximo — Aparelho <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ═══ STEP 2 — APARELHO ═══ */}
          {step === "aparelho" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">IMEI — identificação automática</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={imeiRef} value={imei}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 15); setImei(v); if (imeiResult.status !== "idle") setImeiResult({ status: "idle" }); }}
                      placeholder="Digite os 15 dígitos do IMEI" className="pl-8 h-9 font-mono text-sm tracking-wider" maxLength={15} inputMode="numeric"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={consultarImei} disabled={imeiResult.status === "loading" || imei.length !== 15}>
                    {imeiResult.status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                    Consultar
                  </Button>
                </div>
                {imei.length > 0 && imei.length < 15 && <p className="text-[10px] text-muted-foreground">{imei.length}/15 dígitos</p>}
                {imeiResult.status === "found" && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-800">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">Aparelho identificado via API</p>
                      <p className="text-xs">{imeiResult.marca} {imeiResult.modelo}{imeiResult.capacidade ? ` · ${imeiResult.capacidade}` : ""}{imeiResult.cor ? ` · ${imeiResult.cor}` : ""}</p>
                    </div>
                  </div>
                )}
                {imeiResult.status === "partial" && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div><p className="text-xs font-medium">Identificado parcialmente — confira os dados</p><p className="text-xs">{imeiResult.marca} {imeiResult.modelo}</p></div>
                  </div>
                )}
                {imeiResult.status === "not_found" && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border text-muted-foreground">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-xs">IMEI não identificado — preencha os dados manualmente abaixo.</p>
                  </div>
                )}
                {imeiResult.status === "duplicate" && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-800">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div><p className="text-xs font-medium">IMEI já cadastrado</p>{imeiResult.duplicate && <p className="text-xs">{imeiResult.duplicate.info}</p>}</div>
                  </div>
                )}
                {imeiResult.status === "error" && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-800">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-xs">{imeiResult.message || "Erro ao consultar IMEI"}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ComboboxWithCreate
                  label="Marca *"
                  value={marcaId}
                  items={marcasList}
                  placeholder="Apple, Samsung..."
                  entityName="marca"
                  onChange={(id, nome) => {
                    setMarcaId(id);
                    setMarca(nome);
                    // limpa modelo se marca mudar
                    setModeloId("");
                    setModelo("");
                  }}
                  onCreate={createMarca}
                />
                <ComboboxWithCreate
                  label="Modelo *"
                  value={modeloId}
                  items={modelosFiltrados}
                  placeholder={marcaId ? "iPhone 15, S24..." : "Selecione a marca primeiro"}
                  entityName="modelo"
                  onChange={(id, nome) => { setModeloId(id); setModelo(nome); }}
                  onCreate={createModelo}
                  disabled={!marcaId}
                  disabledReason="Selecione uma marca primeiro"
                />
                <ComboboxWithCreate
                  label="Cor"
                  value={corId}
                  items={coresList}
                  placeholder="Preto, Branco..."
                  entityName="cor"
                  onChange={(id, nome) => { setCorId(id); setCor(nome); }}
                  onCreate={createCor}
                />
                <ComboboxWithCreate
                  label="Capacidade"
                  value={capacidadeId}
                  items={capacidadesList}
                  placeholder="128GB, 256GB..."
                  entityName="capacidade"
                  onChange={(id, nome) => { setCapacidadeId(id); setCapacidade(nome); }}
                  onCreate={createCapacidade}
                />
              </div>

              <div><Label className="text-xs text-muted-foreground">Senha / padrão de desbloqueio</Label><Input value={senhaDesbloqueio} onChange={(e) => setSenhaDesbloqueio(e.target.value)} placeholder="Fornecida pelo cliente (opcional)" className="mt-1 h-9" /></div>
              <div><Label className="text-xs text-muted-foreground">Acessórios recebidos</Label><Input value={acessorios} onChange={(e) => setAcessorios(e.target.value)} placeholder="Cabo, capa, carregador..." className="mt-1 h-9" /></div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep("cliente")}>Voltar</Button>
                <Button className="flex-1" disabled={!canAdvanceAparelho} onClick={() => setStep("servico")}>Próximo — Serviço <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3 — SERVIÇO ═══ */}
          {step === "servico" && (
            <div className="space-y-4">

              {/* ── Serviços ── */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Serviço / Problema relatado *</Label>

                {/* Tags selecionadas */}
                {defeitosSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {defeitosSelecionados.map(d => (
                      <span key={d.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {d.nome}
                        <button type="button" onClick={() => setDefeitosSelecionados(prev => prev.filter(x => x.id !== d.id))} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar serviço..."
                    value={defeitoSearch}
                    onChange={(e) => setDefeitoSearch(e.target.value)}
                    onFocus={() => setDefeitosFocused(true)}
                    onBlur={() => setTimeout(() => setDefeitosFocused(false), 200)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                {/* Dropdown */}
                {defeitosFocused && defeitosFiltrados.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border divide-y bg-popover shadow-md">
                    {defeitosFiltrados.slice(0, 15).map(d => (
                      <button
                        key={d.id} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDefeitosSelecionados(prev => [...prev, {
                            id: d.id, nome: d.nome, categoria: d.categoria, valor_mao_obra: Number(d.valor_mao_obra),
                          }]);
                          setDefeitoSearch("");
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm">{d.nome}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{d.categoria}</p>
                        </div>
                        <span className="text-xs font-medium text-green-600">
                          R$ {Number(d.valor_mao_obra).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Peças ── */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Peças utilizadas
                </Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar peça no estoque..."
                    value={pecaSearch}
                    onChange={(e) => setPecaSearch(e.target.value)}
                    onFocus={() => setPecasFocused(true)}
                    onBlur={() => setTimeout(() => setPecasFocused(false), 200)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                {pecasFocused && pecasFiltradas.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border divide-y bg-popover shadow-md">
                    {pecasFiltradas.slice(0, 15).map(p => (
                      <button
                        key={p.id} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addPeca(p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm">{getPecaNome(p)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Estoque: <span className={p.quantidade === 0 ? "text-destructive font-medium" : ""}>{p.quantidade}</span> | SKU: {p.sku || "—"}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-success">
                          R$ {Number(p.preco_venda ?? 0).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Peças selecionadas */}
                {pecasSelecionadas.length > 0 && (
                  <div className="rounded-lg border divide-y">
                    {pecasSelecionadas.map(p => {
                      const isAuto = p.origens.length > 0;
                      const semEstoque = p.estoque_disponivel === 0;
                      const estoqueInsuficiente = !semEstoque && p.estoque_disponivel < p.quantidade;
                      const origemNomes = p.origens
                        .map(id => servicoNomePorId.get(id))
                        .filter(Boolean) as string[];
                      return (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium truncate">{p.nome}</p>
                            {isAuto && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                                auto
                              </span>
                            )}
                            {semEstoque && (
                              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                            )}
                            {estoqueInsuficiente && (
                              <AlertCircle className="h-3 w-3 text-warning shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            R$ {p.preco_venda.toFixed(2)} / un
                            {isAuto && origemNomes.length > 0 && (
                              <span className="ml-1">· do serviço: {origemNomes.join(", ")}</span>
                            )}
                          </p>
                          {semEstoque && (
                            <p className="text-[10px] text-destructive">Sem estoque — será necessário repor</p>
                          )}
                          {estoqueInsuficiente && (
                            <p className="text-[10px] text-warning">
                              Estoque insuficiente: {p.estoque_disponivel} disponível, {p.quantidade} necessária{p.quantidade > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                          <button type="button" onClick={() => updatePecaQtd(p.id, -1)} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-medium w-6 text-center">{p.quantidade}</span>
                          <button type="button" onClick={() => updatePecaQtd(p.id, 1)} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted">
                            <Plus className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => removePeca(p.id)} className="h-6 w-6 flex items-center justify-center rounded border text-destructive hover:bg-destructive/10 ml-1">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs font-medium ml-3 w-16 text-right">
                          R$ {(p.preco_venda * p.quantidade).toFixed(2)}
                        </span>
                      </div>
                    );})}
                  </div>
                )}
              </div>

              {/* ── Mão de obra adicional + Desconto ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Mão de obra adicional (R$)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={maoObraAdicional}
                      onChange={(e) => setMaoObraAdicional(e.target.value)}
                      type="number" step="0.01" min="0"
                      placeholder="0,00" className="pl-8 h-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value.replace(/^-/, ""))}
                      type="number" step="0.01" min="0"
                      placeholder="0,00" className="pl-8 h-9"
                    />
                  </div>
                </div>
              </div>

              {/* ── Sinal pago + Forma de pagamento ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sinal pago na entrada (R$)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={sinalPago}
                      onChange={(e) => setSinalPago(e.target.value.replace(/^-/, ""))}
                      type="number" step="0.01" min="0"
                      placeholder="0,00" className="pl-8 h-9"
                    />
                  </div>
                </div>
                {sinalPagoNum > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Forma de pagamento do sinal</Label>
                    <select
                      value={formaPagamentoSinal}
                      onChange={(e) => setFormaPagamentoSinal(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="nenhum">Nenhum</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Status orçamento + Garantia ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Status do orçamento</Label>
                  <select
                    value={orcamentoStatus}
                    onChange={(e) => setOrcamentoStatus(e.target.value as "aguardando" | "aprovado" | "recusado")}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="aguardando">Aguardando aprovação</option>
                    <option value="aprovado">Aprovado pelo cliente</option>
                    <option value="recusado">Recusado pelo cliente</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Garantia do serviço (dias)</Label>
                  <Input
                    value={garantiaDias}
                    onChange={(e) => setGarantiaDias(e.target.value.replace(/[^\d]/g, ""))}
                    type="number" min="0"
                    placeholder="90" className="mt-1 h-9"
                  />
                </div>
              </div>

              {/* ── Painel Orçamento ── */}
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Orçamento</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="font-medium">R$ {totalMaoObraDefeitos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Peças</span>
                  <span className="font-medium">R$ {totalPecas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Mão de obra adicional</span>
                  <span className="font-medium">R$ {adicional.toFixed(2)}</span>
                </div>
                {descontoNum > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium text-destructive">− R$ {descontoNum.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-primary/20 pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
                  <span>TOTAL</span>
                  <span className="text-success">R$ {valorTotal.toFixed(2)}</span>
                </div>
                {sinalPagoNum > 0 && (
                  <>
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Sinal pago</span>
                      <span className="font-medium text-success">− R$ {sinalPagoNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-primary/20 pt-1.5 mt-1">
                      <span>A receber na retirada</span>
                      <span className="text-primary">R$ {aReceber.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* ── Conferência na entrada ── */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Conferência na entrada
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1">
                  Clique no status para alternar entre N/T → OK → Defeito. Esta lista será impressa para o cliente assinar.
                </p>
                <ChecklistEntrada
                  value={checklist}
                  onChange={setChecklist}
                  customItems={checklistCustom}
                  onCustomItemsChange={setChecklistCustom}
                />
              </div>

              {/* ── Observações internas + Cliente ── */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Observações internas (só a loja vê)</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Diagnóstico técnico, histórico, tentativas anteriores..."
                    rows={2} className="mt-1 resize-none text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Observações para o cliente (aparecem no recibo)</Label>
                  <Textarea
                    value={obsCliente}
                    onChange={(e) => setObsCliente(e.target.value)}
                    placeholder='Ex: "aparelho sem garantia por já ter sido aberto", "não podemos garantir Face ID após troca de tela"...'
                    rows={2} className="mt-1 resize-none text-sm"
                  />
                </div>
              </div>

              {/* ── Previsão (data + hora) + Técnico ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Previsão de entrega</Label>
                  <div className="mt-1 flex gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("h-9 flex-1 justify-start text-left font-normal text-sm", !previsaoEntrega && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {previsaoEntrega ? format(previsaoEntrega, "dd/MM/yyyy", { locale: ptBR }) : "Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={previsaoEntrega} onSelect={setPrevisaoEntrega} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={previsaoHora}
                      onChange={(e) => setPrevisaoHora(e.target.value)}
                      className="h-9 w-[110px] text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      { label: "Hoje 18h", days: 0, hora: "18:00" },
                      { label: "Amanhã 18h", days: 1, hora: "18:00" },
                      { label: "2 dias", days: 2, hora: "18:00" },
                      { label: "3 dias", days: 3, hora: "18:00" },
                      { label: "1 semana", days: 7, hora: "18:00" },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setPrevisaoEntrega(addDays(new Date(), p.days));
                          setPrevisaoHora(p.hora);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Técnico responsável</Label>
                  {tecnicosList.length > 0 ? (
                    <ComboboxWithCreate
                      value={tecnicoId}
                      onChange={(id, nome) => { setTecnicoId(id); setTecnico(nome); }}
                      items={tecnicosList as any}
                      placeholder="Selecione um técnico..."
                      entityName="técnico"
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 rounded-md border border-dashed border-border bg-muted/20 p-2 text-center">
                      <p className="text-[11px] text-muted-foreground mb-1">Nenhum técnico cadastrado.</p>
                      <Link
                        to="/configuracoes/tecnicos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Cadastrar primeiro técnico em Configurações →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Lojista parceiro ── */}
              {lojistasAtivos.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Lojista parceiro (opcional)</Label>
                  <select
                    value={lojistaId}
                    onChange={(e) => setLojistaId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Nenhum</option>
                    {lojistasAtivos.map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Status ── */}
              <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Status inicial</p>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Recebido</span>
              </div>

              {/* ── Resumo ── */}
              <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{clienteSelecionado?.nome}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Aparelho</span>
                  <span className="font-medium">{marca} {modelo}</span>
                </div>
                {imei && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">IMEI</span>
                    <span className="font-mono text-muted-foreground">{imei}</span>
                  </div>
                )}
                {defeitosSelecionados.length > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Defeitos</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{defeitoRelatado}</span>
                  </div>
                )}
                {valorTotal > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium text-green-600">R$ {valorTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep("aparelho")}>Voltar</Button>
                <Button
                  type="button" className="flex-1"
                  disabled={!canSubmit || createOrderMutation.isPending}
                  onClick={() => createOrderMutation.mutate()}
                >
                  {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Criar Ordem de Serviço
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Sucesso ── */}
          {step === "sucesso" && createdOS && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                <h3 className="text-lg font-semibold">
                  OS #{String(createdOS.numero).padStart(3, "0")} criada com sucesso!
                </h3>
              </div>

              <EtiquetaOS
                data={{
                  numero: createdOS.numero,
                  clienteNome: clienteSelecionado?.nome || "",
                  clienteTelefone: clienteSelecionado?.telefone || "",
                  marca,
                  modelo,
                  capacidade: capacidade || null,
                  defeitos: defeitoRelatado,
                  dataEntrada: new Date().toISOString(),
                  previsaoEntrega: previsaoEntrega?.toISOString() || null,
                  valor: valorTotal || null,
                  imei: imei.replace(/\D/g, "") || null,
                  tecnicoAtribuido: tecnico || null,
                }}
              />

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    resetAll();
                    onOpenChange(false);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
