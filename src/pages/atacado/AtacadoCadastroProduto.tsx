import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Package,
  Settings2,
  ClipboardPaste,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  useAtacadoCadastroDados,
  CURRENCIES_ISO,
} from "@/hooks/useAtacadoCadastroDados";
import { GerenciarAssistencias } from "@/components/atacado/GerenciarAssistencias";
import { EditableCombo } from "@/components/atacado/EditableCombo";
import { AdicionarAssistModeloDialog } from "@/components/atacado/AdicionarAssistModeloDialog";
import { ColarImeisDialog } from "@/components/atacado/ColarImeisDialog";
import { ScannableInput } from "@/components/ui/scannable-input";
import { luhnValid } from "@/lib/luhn";
import { cn } from "@/lib/utils";

type CustoTipo = "frete" | "aduana" | "seguro" | "outro";
type CustoModo = "fixo" | "pct";

interface CustoLinha {
  tipo: CustoTipo;
  descricao: string;
  modo: CustoModo;
  valor: string;
  moeda: string;
}

interface AssistApl {
  nome: string;
  valor: number;
}

interface UnidadeForm {
  imei1: string;
  imei2: string;
  assistencias: AssistApl[];
}

const brl = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string | number | null | undefined) =>
  parseFloat(String(s ?? "").replace(",", ".")) || 0;

const isImei15 = (s: string) => /^\d{15}$/.test(s.trim());

export default function AtacadoCadastroProduto() {
  const navigate = useNavigate();
  const { empresaId } = useEmpresa();
  const {
    grades,
    statusList,
    tiposAssist,
    moedas,
    marcas,
    modelosDe,
    infoModelo,
    catalogo,
    paises,
    capacidadesList,
    condicoes,
    fornecedores,
    coresDe,
    adicionarModelo,
    adicionarCapacidade,
    adicionarCor,
    adicionarGrade,
    adicionarStatus,
    
    addPais,
    addCondicao,
    addFornecedor,
    addMarcaRpc,
    addMoedaRpc,
    recarregar,
  } = useAtacadoCadastroDados();

  // Importação
  const [importado, setImportado] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [numero, setNumero] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [paisOrigem, setPaisOrigem] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [cotacao, setCotacao] = useState("");

  // Produto
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [cor, setCor] = useState("");
  const [grade, setGrade] = useState("");
  const [condicao, setCondicao] = useState("novo");
  const [status, setStatus] = useState("");

  // Custos
  const [custoProduto, setCustoProduto] = useState("");
  const [custos, setCustos] = useState<CustoLinha[]>([]);

  // Venda
  const [precoVenda, setPrecoVenda] = useState("");

  // Unidades
  const [quantidade, setQuantidade] = useState(1);
  const [unidades, setUnidades] = useState<UnidadeForm[]>([
    { imei1: "", imei2: "", assistencias: [] },
  ]);

  // IMEI: cache de duplicados detectados na base por imei => "modelo existente"
  const [duplicados, setDuplicados] = useState<Record<string, string>>({});

  // Inline-add (mantém status/moeda como botão simples)
  const [novoStatus, setNovoStatus] = useState("");
  // (moeda agora usa EditableCombo; sem botão "+ outra moeda" separado)
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showGerAssist, setShowGerAssist] = useState(false);
  const [showColar, setShowColar] = useState(false);

  const [salvando, setSalvando] = useState(false);

  const modeloInfo = useMemo(() => infoModelo(marca, modelo), [marca, modelo, infoModelo]);
  const capacidadesOpts = capacidadesList.map((c) => c.nome);
  const coresOpts = coresDe(marca, modelo);

  // Assistências do modelo selecionado (preço por modelo)
  const [assistModelo, setAssistModelo] = useState<
    { tipo_id: string; tipo_nome: string; valor: number }[]
  >([]);
  const [loadingAssistModelo, setLoadingAssistModelo] = useState(false);
  const [assistReloadKey, setAssistReloadKey] = useState(0);
  const [addAssistOpen, setAddAssistOpen] = useState(false);
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      if (!modeloInfo?.id) {
        setAssistModelo([]);
        return;
      }
      setLoadingAssistModelo(true);
      const { data, error } = await supabase.rpc("atacado_assist_do_modelo" as any, {
        p_modelo_id: modeloInfo.id,
      });
      if (cancel) return;
      setLoadingAssistModelo(false);
      if (!error) setAssistModelo(((data as any) ?? []) as any);
    };
    run();
    return () => {
      cancel = true;
    };
  }, [modeloInfo?.id, assistReloadKey]);

  // Reset ao trocar marca / modelo
  useEffect(() => {
    setModelo("");
    setCapacidade("");
    setCor("");
  }, [marca]);
  useEffect(() => {
    setCapacidade("");
    setCor("");
  }, [modelo]);

  // Ajusta lista de unidades quando quantidade muda
  useEffect(() => {
    setUnidades((prev) => {
      const n = Math.max(1, quantidade);
      if (prev.length === n) return prev;
      if (prev.length < n) {
        return [
          ...prev,
          ...Array.from({ length: n - prev.length }, () => ({
            imei1: "",
            imei2: "",
            assistencias: [],
          })),
        ];
      }
      return prev.slice(0, n);
    });
  }, [quantidade]);

  // Conversões
  const cotacaoNum = num(cotacao);
  const produtoMoedaNum = num(custoProduto);
  const moedaEhBRL = moeda === "BRL";
  const precisaCotacao = importado && !moedaEhBRL;
  const cotacaoValida = !precisaCotacao || cotacaoNum > 0;
  // cotacaoEfetiva: 1 quando não importado ou moeda=BRL; senão cotacaoNum (válida) ou null
  const cotacaoEfetiva: number | null = !precisaCotacao
    ? 1
    : cotacaoNum > 0
    ? cotacaoNum
    : null;
  const produtoBRL =
    cotacaoEfetiva !== null ? produtoMoedaNum * cotacaoEfetiva : 0;
  const precoNum = num(precoVenda);

  const simboloMoeda =
    moedas.find((m) => m.codigo === moeda)?.simbolo ||
    CURRENCIES_ISO.find((c) => c.codigo === moeda)?.simbolo ||
    moeda;

  const custoBaseUnit = useMemo(() => {
    if (cotacaoEfetiva === null) return 0;
    let base = produtoBRL;
    for (const c of custos) {
      const v = num(c.valor);
      if (c.modo === "pct") base += produtoBRL * (v / 100);
      else if (c.moeda === "BRL" || !importado) base += v;
      else base += v * cotacaoEfetiva;
    }
    return base;
  }, [produtoBRL, custos, cotacaoEfetiva, importado]);

  const totalAssistencias = useMemo(
    () =>
      unidades.reduce(
        (s, u) => s + u.assistencias.reduce((ss, a) => ss + (Number(a.valor) || 0), 0),
        0,
      ),
    [unidades],
  );

  const hasDados = cotacaoValida && (produtoBRL > 0 || precoNum > 0);
  const investimentoTotal = custoBaseUnit * unidades.length + totalAssistencias;
  const vendaTotal = precoNum * unidades.length;
  const lucroTotal = vendaTotal - investimentoTotal;
  const markup = investimentoTotal > 0 ? (lucroTotal / investimentoTotal) * 100 : null;
  const margem = vendaTotal > 0 ? (lucroTotal / vendaTotal) * 100 : null;
  const fmtPct = (v: number | null) =>
    v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  // Handlers custos
  const addCusto = () =>
    setCustos((p) => [
      ...p,
      { tipo: "frete", descricao: "", modo: "fixo", valor: "", moeda: "BRL" },
    ]);
  const updCusto = (i: number, patch: Partial<CustoLinha>) =>
    setCustos((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const rmCusto = (i: number) => setCustos((p) => p.filter((_, idx) => idx !== i));

  // Unidades
  const toggleAssistencia = (uIdx: number, nome: string, valor: number) => {
    setUnidades((prev) =>
      prev.map((u, i) => {
        if (i !== uIdx) return u;
        const existe = u.assistencias.find((a) => a.nome === nome);
        if (existe)
          return { ...u, assistencias: u.assistencias.filter((a) => a.nome !== nome) };
        return { ...u, assistencias: [...u.assistencias, { nome, valor }] };
      }),
    );
  };
  const updUnidade = (i: number, patch: Partial<UnidadeForm>) =>
    setUnidades((p) => p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

  // Duplicado: consulta na base ao perder foco
  const checkDuplicado = async (imei: string) => {
    if (!isImei15(imei) || !empresaId) return;
    if (duplicados[imei]) return; // já cacheado
    const { data } = await supabase
      .from("atacado_aparelhos" as any)
      .select("modelo")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .or(`imei_1.eq.${imei},imei_2.eq.${imei}`)
      .limit(1)
      .maybeSingle();
    if (data) {
      setDuplicados((p) => ({ ...p, [imei]: (data as any).modelo || "outro aparelho" }));
    }
  };

  // Inline-add (mantidos)
  const handleAddStatus = async () => {
    if (!novoStatus.trim() || !empresaId) return;
    await adicionarStatus(empresaId, novoStatus.trim());
    setStatus(novoStatus.trim());
    setNovoStatus("");
    setShowAddStatus(false);
  };
  // handleAddMoeda removido — Moeda agora usa EditableCombo com onCreateNew.

  // Bloco 3: colar lista
  const aplicarImeisColados = (lista: string[]) => {
    setQuantidade(lista.length);
    setUnidades(
      lista.map((imei) => ({ imei1: imei, imei2: "", assistencias: [] })),
    );
    // verifica duplicados em batch
    lista.forEach((imei) => checkDuplicado(imei));
    toast.success(`${lista.length} IMEI${lista.length === 1 ? "" : "s"} aplicado${lista.length === 1 ? "" : "s"}`);
  };

  const handleSalvar = async () => {
    if (!marca || !modelo) return toast.error("Informe marca e modelo");

    // Bloco 2: marca nova não pode colidir com nome já existente como modelo
    const marcaNorm = marca.trim().replace(/\s+/g, " ").toLowerCase();
    const marcaJaExiste = marcas.some((m) => m.toLowerCase() === marcaNorm);
    if (!marcaJaExiste) {
      const colideComModelo = catalogo.some(
        (c) => c.modelo && c.modelo !== "—" && c.modelo.toLowerCase() === marcaNorm,
      );
      if (colideComModelo) {
        return toast.error(
          `"${marca.trim()}" já existe como modelo. Cadastre-o escolhendo a marca e depois o modelo.`,
        );
      }
    }

    // Bloco 1.4: cotação obrigatória antes de tudo
    if (precisaCotacao && cotacaoNum <= 0) {
      return toast.error(
        `Informe a cotação da ${moeda} (maior que zero) antes de cadastrar`,
      );
    }

    // Bloco 3.1: IMEI 1 obrigatório
    const idxSemImei = unidades.findIndex((u) => !u.imei1.trim());
    if (idxSemImei >= 0) {
      return toast.error(`Aparelho ${idxSemImei + 1}: informe o IMEI 1`);
    }

    // Bloco 3.1: sem duplicados dentro do lote (IMEI 1 + IMEI 2 não-vazios)
    const todos: string[] = [];
    for (const u of unidades) {
      todos.push(u.imei1.trim());
      const v2 = u.imei2.trim();
      if (v2) todos.push(v2);
    }
    const vistos = new Set<string>();
    for (const v of todos) {
      if (vistos.has(v)) {
        return toast.error(`IMEI ${v} está repetido em mais de um aparelho do lote`);
      }
      vistos.add(v);
    }

    setSalvando(true);
    const payload: any = {
      importado,
      fornecedor,
      numero,
      data_compra: dataCompra || null,
      pais_origem: paisOrigem,
      moeda: importado ? moeda : "BRL",
      cotacao: importado ? cotacao : null,
      marca,
      modelo,
      capacidade,
      cor,
      grade,
      condicao,
      status: status || "estoque",
      custo_produto: produtoMoedaNum,
      preco_venda: precoNum,
      custos: custos
        .filter((c) => importado || (c.tipo !== "aduana" && c.tipo !== "seguro"))
        .map((c) => ({
          tipo: c.tipo,
          descricao: c.descricao,
          modo: c.modo,
          moeda: c.moeda,
          valor: num(c.valor),
        })),
      unidades: unidades.map((u) => ({
        imei1: u.imei1.trim(),
        imei2: u.imei2.trim() || null,
        assistencias: u.assistencias,
      })),
    };
    const { data, error } = await supabase.rpc("atacado_cadastrar_lote" as any, {
      p_payload: payload,
    });
    setSalvando(false);
    if (error || (data as any)?.success === false) {
      toast.error(
        "Erro ao cadastrar: " +
          (error?.message || (data as any)?.error || "tente novamente"),
      );
      return;
    }
    toast.success(`${(data as any).aparelhos} aparelhos cadastrados`);
    navigate("/atacado/aparelhos");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-32">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/atacado/aparelhos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo produto</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um lote: N aparelhos individuais com IMEI próprio
          </p>
        </div>
      </div>

      {/* Importação */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">É um produto importado?</h2>
            <p className="text-xs text-muted-foreground">
              Habilita invoice, país, moeda, cotação e custos aduaneiros
            </p>
          </div>
          <Switch checked={importado} onCheckedChange={setImportado} />
        </div>

        {importado && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <EditableCombo
                value={fornecedor}
                onValueChange={setFornecedor}
                options={fornecedores.filter((f) => f.ativo !== false).map((f) => f.nome)}
                placeholder="Escolher ou cadastrar fornecedor"
                entityLabel="fornecedor"
                onCreateNew={async (typed) => { await addFornecedor(typed); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Nº da invoice</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="INV-001" />
            </div>
            <div className="space-y-2">
              <Label>Data da compra</Label>
              <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>País de origem</Label>
              <EditableCombo
                value={paisOrigem}
                onValueChange={setPaisOrigem}
                options={paises.filter((p) => p.ativo).map((p) => p.nome)}
                placeholder="Escolher ou cadastrar país"
                entityLabel="país"
                onCreateNew={async (typed) => { await addPais(typed); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Moeda da compra</Label>
              <EditableCombo
                value={moeda}
                onValueChange={(v) => setMoeda(v.toUpperCase())}
                options={Array.from(
                  new Set<string>([
                    "BRL",
                    ...moedas.map((m) => m.codigo),
                    ...CURRENCIES_ISO.map((c) => c.codigo),
                  ]),
                )}
                placeholder="Escolher ou cadastrar moeda"
                entityLabel="moeda (ex: USD)"
                onCreateNew={async (typed) => {
                  const codigo = typed.trim().toUpperCase();
                  const iso = CURRENCIES_ISO.find((c) => c.codigo === codigo);
                  await addMoedaRpc(codigo, iso?.simbolo, iso?.nome);
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                {moeda === "BRL"
                  ? "Real — sem conversão"
                  : `${simboloMoeda} ${
                      CURRENCIES_ISO.find((c) => c.codigo === moeda)?.nome ||
                      moedas.find((m) => m.codigo === moeda)?.nome ||
                      ""
                    }`}
              </p>
            </div>
            {moedaEhBRL ? (
              <div className="space-y-2">
                <Label>Cotação</Label>
                <Input value="1,00" disabled />
                <p className="text-[10px] text-muted-foreground">Moeda BRL — sem conversão</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>
                  Cotação ({simboloMoeda} → R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  inputMode="decimal"
                  value={cotacao}
                  onChange={(e) => setCotacao(e.target.value)}
                  placeholder="Ex: 5,40"
                  className={cn(!cotacaoValida && "border-destructive focus-visible:ring-destructive")}
                />
                {!cotacaoValida && (
                  <p className="text-xs text-destructive">Obrigatória quando a moeda não é BRL</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Produto — combos editáveis */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Produto</h2>
          <span className="text-xs text-muted-foreground">
            Não achou? Digite e use — fica salvo no catálogo para o próximo cadastro.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Marca *</Label>
            <EditableCombo
              value={marca}
              onValueChange={setMarca}
              options={marcas}
              placeholder="Escolher ou digitar marca"
              entityLabel="marca"
              emptyHint="Nenhuma marca no catálogo — digite uma nova"
              onCreateNew={async (typed) => { await addMarcaRpc(typed); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Modelo *</Label>
            <EditableCombo
              value={modelo}
              onValueChange={setModelo}
              options={modelosDe(marca)}
              placeholder={marca ? "Escolher ou digitar modelo" : "Escolha a marca primeiro"}
              disabled={!marca}
              entityLabel="modelo"
              onCreateNew={async (typed) => {
                if (!empresaId || !marca) return;
                await adicionarModelo(empresaId, marca, typed);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacidade</Label>
            <EditableCombo
              value={capacidade}
              onValueChange={setCapacidade}
              options={capacidadesOpts}
              placeholder="Ex: 128 GB"
              entityLabel="capacidade"
              onCreateNew={async (typed) => { await adicionarCapacidade("", typed); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <EditableCombo
              value={cor}
              onValueChange={setCor}
              options={coresOpts}
              placeholder={modelo ? "Ex: Preto" : "Defina o modelo"}
              disabled={!modelo}
              entityLabel="cor"
              onCreateNew={async (typed) => {
                if (modeloInfo) await adicionarCor(modeloInfo.id, typed);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Grade</Label>
            <EditableCombo
              value={grade}
              onValueChange={setGrade}
              options={grades.map((g) => g.nome)}
              placeholder="Ex: Grade A"
              entityLabel="grade"
              onCreateNew={async (typed) => {
                if (empresaId) await adicionarGrade(empresaId, typed);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Condição</Label>
            <EditableCombo
              value={condicao}
              onValueChange={setCondicao}
              options={condicoes.filter((c) => c.ativo).map((c) => c.nome)}
              placeholder="Escolher ou cadastrar condição"
              entityLabel="condição"
              emptyHint="Sem condições cadastradas — digite uma (ex: Novo, Seminovo, Vitrine)"
              onCreateNew={async (typed) => { await addCondicao(typed); }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status do aparelho</Label>
          <div className="flex flex-wrap gap-2">
            {statusList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.nome)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  status === s.nome
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {s.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAddStatus((v) => !v)}
              className="px-3 py-1.5 rounded-full text-xs border border-dashed text-muted-foreground hover:bg-muted"
            >
              + novo status
            </button>
          </div>
          {showAddStatus && (
            <div className="flex gap-2 max-w-md">
              <Input value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} placeholder="Nome do status" />
              <Button size="sm" onClick={handleAddStatus}>Salvar</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Custos */}
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Custos da compra</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Custo do produto / un {importado && simboloMoeda !== "R$" ? `(${simboloMoeda})` : "(R$)"}
            </Label>
            <Input inputMode="decimal" value={custoProduto} onChange={(e) => setCustoProduto(e.target.value)} placeholder="0,00" />
            {importado && cotacaoNum > 0 && produtoMoedaNum > 0 && (
              <p className="text-xs text-muted-foreground">≈ {brl(produtoBRL)} / un</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Fretes e taxas</Label>
            <Button type="button" variant="outline" size="sm" onClick={addCusto}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          {custos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum custo adicional. Cada custo é rateado igualmente por unidade.
            </p>
          )}
          {custos.map((c, i) => {
            const ehImportOnly = c.tipo === "aduana" || c.tipo === "seguro";
            if (!importado && ehImportOnly) return null;
            const isPct = c.modo === "pct";
            const pctNum = num(c.valor);
            const baseProd = produtoBRL ?? 0;
            const valorCalc = isPct ? (pctNum / 100) * baseProd : num(c.valor);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-md">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={c.tipo} onValueChange={(v) => updCusto(i, { tipo: v as CustoTipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frete">Frete</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      {importado && <SelectItem value="aduana">Aduana</SelectItem>}
                      {importado && <SelectItem value="seguro">Seguro</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={c.descricao} onChange={(e) => updCusto(i, { descricao: e.target.value })} placeholder="Ex: Frete internacional" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Modo</Label>
                  <Select
                    value={c.modo}
                    onValueChange={(v) => {
                      const novoModo = v as CustoModo;
                      if (novoModo === c.modo) return;
                      // Primeiro troca o modo e ZERA o valor (evita misturar % com R$
                      // e qualquer cálculo inseguro herdado do modo anterior).
                      updCusto(i, {
                        modo: novoModo,
                        valor: "",
                        moeda: novoModo === "pct" ? "BRL" : c.moeda,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Fixo</SelectItem>
                      <SelectItem value="pct">% do produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">{isPct ? "Base" : "Moeda"}</Label>
                  {isPct ? (
                    <div className="h-10 px-3 flex items-center text-xs text-muted-foreground border rounded-md bg-muted/30">
                      Custo do produto
                    </div>
                  ) : (
                    <Select
                      value={c.moeda}
                      onValueChange={(v) => updCusto(i, { moeda: v })}
                      disabled={!importado || moeda === "BRL"}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">R$</SelectItem>
                        {importado && moeda !== "BRL" && (
                          <SelectItem value={moeda}>{simboloMoeda}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">
                    Valor{" "}
                    {isPct
                      ? "(%)"
                      : `(${importado && c.moeda !== "BRL" ? simboloMoeda : "R$"})`}
                  </Label>
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      value={c.valor}
                      onChange={(e) => updCusto(i, { valor: e.target.value })}
                      placeholder={isPct ? "0" : "0,00"}
                      className={isPct ? "pr-7" : ""}
                    />
                    {isPct && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                    )}
                  </div>
                  {isPct && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      = {brl(Number(valorCalc) || 0)} <span className="opacity-70">(sobre o custo do produto)</span>
                    </p>
                  )}
                  {!isPct &&
                    importado &&
                    c.moeda !== "BRL" &&
                    cotacaoEfetiva !== null &&
                    num(c.valor) > 0 && (
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        ≈ {brl(num(c.valor) * cotacaoEfetiva)}
                      </p>
                    )}
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => rmCusto(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Venda */}
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Preço de venda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor sugerido por unidade (R$)</Label>
            <Input inputMode="decimal" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} placeholder="0,00" />
          </div>
        </div>
      </Card>

      {/* Unidades */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-foreground">Aparelhos do lote</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
              className="w-24"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowColar(true)}>
              <ClipboardPaste className="h-4 w-4" /> Colar lista de IMEIs
            </Button>
            <Dialog open={showGerAssist} onOpenChange={setShowGerAssist}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Settings2 className="h-4 w-4" /> Gerenciar assistências
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Tipos de assistência</DialogTitle>
                </DialogHeader>
                <GerenciarAssistencias tipos={tiposAssist} onChange={recarregar} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-3">
          {unidades.map((u, i) => {
            const unitTotal =
              custoBaseUnit +
              u.assistencias.reduce((s, a) => s + (Number(a.valor) || 0), 0);
            const v1 = u.imei1.trim();
            const imei1Erro = v1.length > 0 && !isImei15(v1);
            const luhnAviso = !imei1Erro && v1.length === 15 && !luhnValid(v1);
            const dupModelo = duplicados[v1];
            return (
              <div key={i} className="p-3 border rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Aparelho {i + 1}</Badge>
                  <span className="text-xs text-muted-foreground">
                    custo desta unidade:{" "}
                    <strong className="text-foreground">
                      {unitTotal > 0 ? brl(unitTotal) : "—"}
                    </strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">IMEI 1 *</Label>
                    <ScannableInput
                      value={u.imei1}
                      onChange={(e) => updUnidade(i, { imei1: e.target.value })}
                      onBlur={(e) => checkDuplicado(e.target.value.trim())}
                      placeholder="15 dígitos"
                      scannerTitle="Escanear IMEI"
                      className={cn(
                        imei1Erro && "border-destructive focus-visible:ring-destructive",
                      )}
                      inputMode="numeric"
                      maxLength={15}
                    />
                    {imei1Erro && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        IMEI deve ter 15 dígitos
                      </p>
                    )}
                    {luhnAviso && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Dígito verificador não confere (alguns aparelhos importados são assim)
                      </p>
                    )}
                    {!imei1Erro && dupModelo && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        IMEI já cadastrado ({dupModelo})
                      </p>
                    )}
                    {!imei1Erro && v1.length === 15 && !luhnAviso && !dupModelo && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> IMEI válido
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IMEI 2 (opcional)</Label>
                    <Input
                      value={u.imei2}
                      onChange={(e) => updUnidade(i, { imei2: e.target.value })}
                      inputMode="numeric"
                      maxLength={15}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-xs">
                      Assistências{modeloInfo ? ` de ${modeloInfo.marca} ${modeloInfo.modelo}` : ""} (carimba o valor atual)
                    </Label>
                    {modelo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary"
                        onClick={() => setAddAssistOpen(true)}
                        disabled={!modeloInfo?.id}
                        title={
                          !modeloInfo?.id
                            ? "Aguardando catálogo sincronizar este modelo…"
                            : ""
                        }
                      >
                        <Plus className="h-3 w-3" /> Adicionar assistência a este modelo
                      </Button>
                    )}
                  </div>
                  {!modelo ? (
                    <p className="text-xs text-muted-foreground">
                      Selecione um modelo para ver as assistências disponíveis.
                    </p>
                  ) : !modeloInfo?.id ? (
                    <p className="text-xs text-muted-foreground">
                      Sincronizando catálogo do modelo recém-criado…
                    </p>
                  ) : loadingAssistModelo ? (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  ) : assistModelo.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Este modelo ainda não tem assistências configuradas.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assistModelo.map((t) => {
                        const ativo = !!u.assistencias.find((a) => a.nome === t.tipo_nome);
                        return (
                          <button
                            key={t.tipo_id}
                            type="button"
                            onClick={() =>
                              toggleAssistencia(i, t.tipo_nome, Number(t.valor) || 0)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                              ativo
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted"
                            }`}
                          >
                            {t.tipo_nome} · {brl(Number(t.valor) || 0)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/atacado/aparelhos")}>
          Cancelar
        </Button>
        <Button onClick={handleSalvar} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Cadastrar {unidades.length} aparelho{unidades.length > 1 ? "s" : ""}
        </Button>
      </div>

      {/* Bloco 4: barra sticky de visão geral */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              Lote · {unidades.length} un
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm flex-1 min-w-0">
            <StickyKpi label="Custo / un" value={hasDados ? brl(custoBaseUnit) : "—"} />
            <StickyKpi label="Investimento" value={hasDados ? brl(investimentoTotal) : "—"} />
            <StickyKpi label="Venda total" value={precoNum > 0 ? brl(vendaTotal) : "—"} />
            <StickyKpi
              label="Lucro"
              value={hasDados && precoNum > 0 ? brl(lucroTotal) : "—"}
              sub={
                hasDados && precoNum > 0
                  ? `Markup ${fmtPct(markup)} · Margem ${fmtPct(margem)}`
                  : undefined
              }
              positive={lucroTotal >= 0}
            />
          </div>
          <Button onClick={handleSalvar} disabled={salvando} size="sm">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Cadastrar {unidades.length}
          </Button>
        </div>
      </div>

      <ColarImeisDialog
        open={showColar}
        onOpenChange={setShowColar}
        onConfirm={aplicarImeisColados}
      />

      <AdicionarAssistModeloDialog
        open={addAssistOpen}
        onOpenChange={setAddAssistOpen}
        modeloId={modeloInfo?.id}
        modeloNome={modeloInfo ? `${modeloInfo.marca} ${modeloInfo.modelo}` : undefined}
        tipos={tiposAssist}
        jaVinculados={new Set(assistModelo.map((a) => a.tipo_id))}
        onSaved={() => setAssistReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function StickyKpi({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums truncate",
          positive === false ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
        {sub && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}
