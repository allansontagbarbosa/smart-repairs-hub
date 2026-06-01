import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  useAtacadoCadastroDados,
  CURRENCIES_ISO,
} from "@/hooks/useAtacadoCadastroDados";

interface CustoLinha {
  tipo: "frete" | "aduana" | "seguro" | "outro";
  descricao: string;
  modo: "fixo" | "pct";
  valor: number;
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

export default function AtacadoCadastroProduto() {
  const navigate = useNavigate();
  const { empresaId } = useEmpresa();
  const {
    grades,
    statusList,
    tiposAssist,
    moedas,
    coresDoModelo,
    adicionarCor,
    adicionarGrade,
    adicionarStatus,
    adicionarMoeda,
    recarregar,
  } = useAtacadoCadastroDados();

  // Importação
  const [importado, setImportado] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [numero, setNumero] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [paisOrigem, setPaisOrigem] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [cotacao, setCotacao] = useState("1");

  // Produto
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [cor, setCor] = useState("");
  const [grade, setGrade] = useState("");
  const [condicao, setCondicao] = useState("novo");
  const [status, setStatus] = useState("estoque");

  // Custos
  const [custoProduto, setCustoProduto] = useState("0");
  const [custos, setCustos] = useState<CustoLinha[]>([]);

  // Venda
  const [precoVenda, setPrecoVenda] = useState("0");

  // Unidades
  const [quantidade, setQuantidade] = useState(1);
  const [unidades, setUnidades] = useState<UnidadeForm[]>([
    { imei1: "", imei2: "", assistencias: [] },
  ]);

  // Cores inteligentes
  const [coresModelo, setCoresModelo] = useState<string[]>([]);
  const [novaCor, setNovaCor] = useState("");
  const [showNovaCor, setShowNovaCor] = useState(false);

  // Inputs para criação inline
  const [novaGrade, setNovaGrade] = useState("");
  const [showNovaGrade, setShowNovaGrade] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [showNovoStatus, setShowNovoStatus] = useState(false);
  const [showAddMoeda, setShowAddMoeda] = useState(false);

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (marca && modelo) {
      coresDoModelo(marca, modelo).then(setCoresModelo);
    } else {
      setCoresModelo([]);
    }
  }, [marca, modelo, coresDoModelo]);

  // ajusta lista de unidades quando quantidade muda
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

  // Cálculo do custo base por unidade (espelha a RPC)
  const produtoNum = Number(custoProduto) || 0;
  const precoNum = Number(precoVenda) || 0;

  const custoBaseUnit = useMemo(() => {
    let base = produtoNum;
    for (const c of custos) {
      if (c.modo === "pct") base += produtoNum * ((Number(c.valor) || 0) / 100);
      else base += Number(c.valor) || 0;
    }
    return base;
  }, [produtoNum, custos]);

  const totalAssistencias = useMemo(
    () =>
      unidades.reduce(
        (s, u) =>
          s + u.assistencias.reduce((ss, a) => ss + (Number(a.valor) || 0), 0),
        0,
      ),
    [unidades],
  );

  const investimentoTotal = custoBaseUnit * unidades.length + totalAssistencias;
  const vendaTotal = precoNum * unidades.length;
  const lucroTotal = vendaTotal - investimentoTotal;
  const margem =
    investimentoTotal > 0 ? (lucroTotal / investimentoTotal) * 100 : 0;

  // Handlers
  const addCusto = () =>
    setCustos((p) => [
      ...p,
      { tipo: "frete", descricao: "", modo: "fixo", valor: 0 },
    ]);
  const updCusto = (i: number, patch: Partial<CustoLinha>) =>
    setCustos((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const rmCusto = (i: number) =>
    setCustos((p) => p.filter((_, idx) => idx !== i));

  const toggleAssistencia = (uIdx: number, nome: string, valor: number) => {
    setUnidades((prev) =>
      prev.map((u, i) => {
        if (i !== uIdx) return u;
        const existe = u.assistencias.find((a) => a.nome === nome);
        if (existe) {
          return {
            ...u,
            assistencias: u.assistencias.filter((a) => a.nome !== nome),
          };
        }
        return { ...u, assistencias: [...u.assistencias, { nome, valor }] };
      }),
    );
  };

  const updUnidade = (i: number, patch: Partial<UnidadeForm>) =>
    setUnidades((p) => p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

  const handleSalvarCor = async () => {
    if (!novaCor.trim() || !marca || !modelo || !empresaId) return;
    await adicionarCor(empresaId, marca, modelo, novaCor.trim());
    setCor(novaCor.trim());
    setCoresModelo((p) => [...p, novaCor.trim()]);
    setNovaCor("");
    setShowNovaCor(false);
  };

  const handleSalvarGrade = async () => {
    if (!novaGrade.trim() || !empresaId) return;
    await adicionarGrade(empresaId, novaGrade.trim());
    setGrade(novaGrade.trim());
    setNovaGrade("");
    setShowNovaGrade(false);
  };

  const handleSalvarStatus = async () => {
    if (!novoStatus.trim() || !empresaId) return;
    await adicionarStatus(empresaId, novoStatus.trim());
    setStatus(novoStatus.trim());
    setNovoStatus("");
    setShowNovoStatus(false);
  };

  const handleAddMoeda = async (codigo: string) => {
    if (!empresaId) return;
    const iso = CURRENCIES_ISO.find((c) => c.codigo === codigo);
    await adicionarMoeda(empresaId, codigo, iso?.simbolo, iso?.nome);
    setMoeda(codigo);
    setShowAddMoeda(false);
  };

  const handleSalvar = async () => {
    if (!marca || !modelo) {
      toast.error("Informe marca e modelo");
      return;
    }
    if (unidades.some((u) => !u.imei1.trim())) {
      toast.error("Informe o IMEI 1 de todos os aparelhos");
      return;
    }
    setSalvando(true);
    const payload: any = {
      importado,
      fornecedor,
      numero,
      data_compra: dataCompra || null,
      pais_origem: paisOrigem,
      moeda,
      cotacao: cotacao || null,
      marca,
      modelo,
      capacidade,
      cor,
      grade,
      condicao,
      status,
      custo_produto: produtoNum,
      preco_venda: precoNum,
      custos: importado
        ? custos
        : custos.filter((c) => c.tipo === "frete" || c.tipo === "outro"),
      unidades: unidades.map((u) => ({
        imei1: u.imei1.trim(),
        imei2: u.imei2.trim() || null,
        assistencias: u.assistencias,
      })),
    };
    const { data, error } = await supabase.rpc(
      "atacado_cadastrar_lote" as any,
      { p_payload: payload },
    );
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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
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
      </div>

      {/* Importação */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              É um produto importado?
            </h2>
            <p className="text-xs text-muted-foreground">
              Habilita dados de invoice, país, moeda e custos aduaneiros
            </p>
          </div>
          <Switch checked={importado} onCheckedChange={setImportado} />
        </div>

        {importado && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nº da invoice</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data da compra</Label>
              <Input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>País de origem</Label>
              <Input
                value={paisOrigem}
                onChange={(e) => setPaisOrigem(e.target.value)}
                placeholder="Ex: China, EUA, Paraguai"
              />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <div className="flex gap-2">
                <Select value={moeda} onValueChange={setMoeda}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL — Real</SelectItem>
                    {moedas.map((m) => (
                      <SelectItem key={m.id} value={m.codigo}>
                        {m.codigo} {m.nome ? `— ${m.nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddMoeda((s) => !s)}
                  title="Adicionar moeda"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {showAddMoeda && (
                <Select onValueChange={handleAddMoeda}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher moeda ISO…" />
                  </SelectTrigger>
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
              <Label>Cotação (R$ por unidade)</Label>
              <Input
                type="number"
                step="0.0001"
                value={cotacao}
                onChange={(e) => setCotacao(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Produto */}
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Produto</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Marca *</Label>
            <Input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Apple, Samsung…"
            />
          </div>
          <div className="space-y-2">
            <Label>Modelo *</Label>
            <Input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="iPhone 15 Pro"
            />
          </div>
          <div className="space-y-2">
            <Label>Capacidade</Label>
            <Input
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              placeholder="256GB"
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              <Select
                value={cor}
                onValueChange={(v) => {
                  if (v === "__nova") setShowNovaCor(true);
                  else setCor(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      coresModelo.length === 0
                        ? "Defina marca e modelo primeiro"
                        : "Escolher cor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {coresModelo.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="__nova">+ outra cor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showNovaCor && (
              <div className="flex gap-2">
                <Input
                  value={novaCor}
                  onChange={(e) => setNovaCor(e.target.value)}
                  placeholder="Nome da cor"
                />
                <Button type="button" size="sm" onClick={handleSalvarCor}>
                  Salvar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Grade</Label>
            <div className="flex gap-2">
              <Select
                value={grade}
                onValueChange={(v) => {
                  if (v === "__nova") setShowNovaGrade(true);
                  else setGrade(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolher grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.nome}>
                      {g.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="__nova">+ cadastrar grade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showNovaGrade && (
              <div className="flex gap-2">
                <Input
                  value={novaGrade}
                  onChange={(e) => setNovaGrade(e.target.value)}
                  placeholder="Ex: Grade A"
                />
                <Button type="button" size="sm" onClick={handleSalvarGrade}>
                  Salvar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Condição</Label>
            <Select value={condicao} onValueChange={setCondicao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="seminovo">Seminovo</SelectItem>
                <SelectItem value="usado">Usado</SelectItem>
                <SelectItem value="vitrine">Vitrine</SelectItem>
              </SelectContent>
            </Select>
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
              onClick={() => setStatus("estoque")}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                status === "estoque" && !statusList.find((s) => s.nome === "estoque")
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              Em estoque
            </button>
            <button
              type="button"
              onClick={() => setShowNovoStatus((v) => !v)}
              className="px-3 py-1.5 rounded-full text-xs border border-dashed text-muted-foreground hover:bg-muted"
            >
              + novo status
            </button>
          </div>
          {showNovoStatus && (
            <div className="flex gap-2 max-w-md">
              <Input
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
                placeholder="Nome do status"
              />
              <Button type="button" size="sm" onClick={handleSalvarStatus}>
                Salvar
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Custos */}
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Custos da compra</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Custo do produto (por unidade, em R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={custoProduto}
              onChange={(e) => setCustoProduto(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Fretes e taxas</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCusto}
            >
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          {custos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum custo adicional. Cada custo será rateado por unidade.
            </p>
          )}
          {custos.map((c, i) => {
            const ehImportOnly = c.tipo === "aduana" || c.tipo === "seguro";
            if (!importado && ehImportOnly) return null;
            return (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-end p-3 border rounded-md"
              >
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={c.tipo}
                    onValueChange={(v) => updCusto(i, { tipo: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frete">Frete</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      {importado && (
                        <>
                          <SelectItem value="aduana">Aduana</SelectItem>
                          <SelectItem value="seguro">Seguro</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={c.descricao}
                    onChange={(e) => updCusto(i, { descricao: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Modo</Label>
                  <Select
                    value={c.modo}
                    onValueChange={(v) => updCusto(i, { modo: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">R$ fixo</SelectItem>
                      <SelectItem value="pct">% do produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={c.valor}
                    onChange={(e) =>
                      updCusto(i, { valor: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => rmCusto(i)}
                  >
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
            <Input
              type="number"
              step="0.01"
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Unidades */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Aparelhos do lote
          </h2>
          <div className="flex items-center gap-3">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={quantidade}
              onChange={(e) =>
                setQuantidade(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-24"
            />
          </div>
        </div>

        <div className="space-y-3">
          {unidades.map((u, i) => (
            <div key={i} className="p-3 border rounded-md space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Aparelho {i + 1}</Badge>
                <span className="text-xs text-muted-foreground">
                  custo desta unidade:{" "}
                  <strong className="text-foreground">
                    {brl(
                      custoBaseUnit +
                        u.assistencias.reduce(
                          (s, a) => s + (Number(a.valor) || 0),
                          0,
                        ),
                    )}
                  </strong>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">IMEI 1 *</Label>
                  <Input
                    value={u.imei1}
                    onChange={(e) => updUnidade(i, { imei1: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IMEI 2 (opcional)</Label>
                  <Input
                    value={u.imei2}
                    onChange={(e) => updUnidade(i, { imei2: e.target.value })}
                  />
                </div>
              </div>
              {tiposAssist.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Assistências</Label>
                  <div className="flex flex-wrap gap-2">
                    {tiposAssist.map((t) => {
                      const ativo = !!u.assistencias.find(
                        (a) => a.nome === t.nome,
                      );
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            toggleAssistencia(
                              i,
                              t.nome,
                              Number(t.valor_padrao) || 0,
                            )
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
          ))}
        </div>
      </Card>

      {/* Visão geral */}
      <Card className="p-5 space-y-3 bg-primary/5 border-primary/30">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Visão geral do lote
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <KpiMini label="Custo / unidade" value={brl(custoBaseUnit)} />
          <KpiMini label="Investimento total" value={brl(investimentoTotal)} />
          <KpiMini label="Venda total" value={brl(vendaTotal)} />
          <KpiMini
            label="Lucro"
            value={brl(lucroTotal)}
            sub={`Margem ${Math.round(margem)}% (s/ investimento)`}
            positive={lucroTotal >= 0}
          />
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
    </div>
  );
}

function KpiMini({
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
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          positive === false ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
