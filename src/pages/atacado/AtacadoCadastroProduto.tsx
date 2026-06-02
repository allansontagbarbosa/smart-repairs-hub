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

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;

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
    adicionarMoeda,
    addPais,
    addCondicao,
    addFornecedor,
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
  const [showAddMoeda, setShowAddMoeda] = useState(false);
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
  }, [modeloInfo?.id]);

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
  const produtoBRL =
    importado && cotacaoNum > 0 ? produtoMoedaNum * cotacaoNum : produtoMoedaNum;
  const precoNum = num(precoVenda);

  const simboloMoeda =
    moedas.find((m) => m.codigo === moeda)?.simbolo ||
    CURRENCIES_ISO.find((c) => c.codigo === moeda)?.simbolo ||
    moeda;

  const custoBaseUnit = useMemo(() => {
    let base = produtoBRL;
    for (const c of custos) {
      const v = num(c.valor);
      if (c.modo === "pct") base += produtoBRL * (v / 100);
      else if (c.moeda === "BRL" || !importado) base += v;
      else base += v * (cotacaoNum > 0 ? cotacaoNum : 1);
    }
    return base;
  }, [produtoBRL, custos, cotacaoNum, importado]);

  const totalAssistencias = useMemo(
    () =>
      unidades.reduce(
        (s, u) => s + u.assistencias.reduce((ss, a) => ss + (Number(a.valor) || 0), 0),
        0,
      ),
    [unidades],
  );

  const hasDados = produtoBRL > 0 || precoNum > 0;
  const investimentoTotal = custoBaseUnit * unidades.length + totalAssistencias;
  const vendaTotal = precoNum * unidades.length;
  const lucroTotal = vendaTotal - investimentoTotal;
  const margem = investimentoTotal > 0 ? (lucroTotal / investimentoTotal) * 100 : 0;

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
  const handleAddMoeda = async (codigo: string) => {
    if (!empresaId) return;
    const iso = CURRENCIES_ISO.find((c) => c.codigo === codigo);
    await adicionarMoeda(empresaId, codigo, iso?.simbolo, iso?.nome);
    setMoeda(codigo);
    setShowAddMoeda(false);
  };

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
    if (unidades.some((u) => !u.imei1.trim()))
      return toast.error("Informe o IMEI 1 de todos os aparelhos");
    const invalidos = unidades.filter((u) => !isImei15(u.imei1));
    if (invalidos.length > 0)
      return toast.error(`${invalidos.length} IMEI(s) inválido(s): devem ter 15 dígitos`);
    if (importado && cotacaoNum <= 0)
      return toast.error("Informe a cotação da moeda da compra");

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
                onCreateNew={async (typed) => { await addPais(typed); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Moeda da compra</Label>
              <div className="flex gap-2">
                <Select value={moeda} onValueChange={setMoeda}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL — Real</SelectItem>
                    {moedas.map((m) => (
                      <SelectItem key={m.id} value={m.codigo}>
                        {m.codigo} {m.nome ? `— ${m.nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setShowAddMoeda((s) => !s)} title="+ outra moeda">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {showAddMoeda && (
                <Select onValueChange={handleAddMoeda}>
                  <SelectTrigger><SelectValue placeholder="Escolher moeda ISO…" /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES_ISO.map((c) => (
                      <SelectItem key={c.codigo} value={c.codigo}>
                        {c.codigo} — {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cotação ({simboloMoeda} → R$)</Label>
              <Input inputMode="decimal" value={cotacao} onChange={(e) => setCotacao(e.target.value)} placeholder="Ex: 5,40" />
            </div>
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
              emptyHint="Nenhuma marca no catálogo — digite uma nova"
              /* não persiste sozinha; será criada junto com o primeiro modelo */
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
                  <Select value={c.modo} onValueChange={(v) => updCusto(i, { modo: v as CustoModo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Fixo</SelectItem>
                      <SelectItem value="pct">% do produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Moeda</Label>
                  <Select
                    value={c.modo === "pct" ? "BRL" : c.moeda}
                    onValueChange={(v) => updCusto(i, { moeda: v })}
                    disabled={c.modo === "pct" || !importado || moeda === "BRL"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">R$</SelectItem>
                      {importado && moeda !== "BRL" && (
                        <SelectItem value={moeda}>{simboloMoeda}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input inputMode="decimal" value={c.valor} onChange={(e) => updCusto(i, { valor: e.target.value })} placeholder={c.modo === "pct" ? "0%" : "0,00"} />
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
                {tiposAssist.filter((t) => t.ativo).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Assistências (carimba o valor atual)</Label>
                    <div className="flex flex-wrap gap-2">
                      {tiposAssist.filter((t) => t.ativo).map((t) => {
                        const ativo = !!u.assistencias.find((a) => a.nome === t.nome);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              toggleAssistencia(i, t.nome, Number(t.valor_padrao) || 0)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                              ativo
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted"
                            }`}
                          >
                            {t.nome} · {brl(Number(t.valor_padrao) || 0)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  ? `Margem ${Math.round(margem)}%`
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
