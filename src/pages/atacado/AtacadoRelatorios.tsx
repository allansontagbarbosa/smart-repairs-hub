import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { BarChart2, Download, FileText, Package, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";

export default function AtacadoRelatorios() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState("este_mes");

  const hoje = new Date();
  const { inicio, fim } = (() => {
    const hojeStr = hoje.toISOString().slice(0, 10);
    if (periodo === "este_mes")
      return {
        inicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`,
        fim: hojeStr,
      };
    if (periodo === "ultimos_30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { inicio: d.toISOString().slice(0, 10), fim: hojeStr };
    }
    if (periodo === "ultimos_90") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { inicio: d.toISOString().slice(0, 10), fim: hojeStr };
    }
    if (periodo === "este_ano")
      return { inicio: `${hoje.getFullYear()}-01-01`, fim: hojeStr };
    return {
      inicio: `${hoje.getFullYear() - 1}-01-01`,
      fim: `${hoje.getFullYear() - 1}-12-31`,
    };
  })();

  if (!empresaId) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios Atacado</h1>
          <p className="text-sm text-muted-foreground">
            DRE, rankings, giro de estoque e análise de clientes
          </p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="este_mes">Este mês</SelectItem>
            <SelectItem value="ultimos_30">Últimos 30 dias</SelectItem>
            <SelectItem value="ultimos_90">Últimos 90 dias</SelectItem>
            <SelectItem value="este_ano">Este ano</SelectItem>
            <SelectItem value="ano_passado">Ano passado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="dre" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dre">
            <FileText className="h-4 w-4 mr-2" /> DRE
          </TabsTrigger>
          <TabsTrigger value="produtos">
            <BarChart2 className="h-4 w-4 mr-2" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="giro">
            <Package className="h-4 w-4 mr-2" /> Giro de Estoque
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="h-4 w-4 mr-2" /> Análise Clientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dre">
          <RelatorioDRE empresaId={empresaId} inicio={inicio} fim={fim} />
        </TabsContent>
        <TabsContent value="produtos">
          <RelatorioProdutos empresaId={empresaId} inicio={inicio} fim={fim} />
        </TabsContent>
        <TabsContent value="giro">
          <RelatorioGiro empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="clientes">
          <RelatorioRFM empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function RelatorioDRE({ empresaId, inicio, fim }: any) {
  const { data: dre, isLoading } = useQuery({
    queryKey: ["atacado-dre", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_dre", {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data?.[0];
    },
  });

  if (isLoading) return <LoadingBlock />;
  if (!dre)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Sem dados no período
      </Card>
    );

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">DRE Atacado</h2>

      <div className="divide-y border rounded-lg">
        <Linha label="(+) Faturamento bruto" valor={Number(dre.faturamento_bruto)} />
        <Linha label="(−) Descontos concedidos" valor={-Number(dre.descontos)} />
        <Linha label="(=) Faturamento líquido" valor={Number(dre.faturamento_liquido)} bold />
        <Linha label="(−) Custo dos produtos" valor={-Number(dre.custo_produtos)} />
        <Linha label="(=) Lucro bruto" valor={Number(dre.lucro_bruto)} bold cor="text-success" />
        <Linha label="(−) Comissões estimadas" valor={-Number(dre.comissoes_estimadas)} />
        <Linha
          label="(=) Resultado operacional"
          valor={Number(dre.resultado_operacional)}
          bold
          large
          cor={Number(dre.resultado_operacional) >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiSmall label="Margem bruta" valor={`${Number(dre.margem_bruta_pct).toFixed(1)}%`} />
        <KpiSmall label="Pedidos no período" valor={String(dre.qtd_pedidos)} />
        <KpiSmall label="Ticket médio" valor={formatBRL(Number(dre.ticket_medio))} />
        <KpiSmall
          label="Inadimplência atual"
          valor={formatBRL(Number(dre.inadimplencia))}
          danger={Number(dre.inadimplencia) > 0}
        />
      </div>
    </Card>
  );
}

function RelatorioProdutos({ empresaId, inicio, fim }: any) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["atacado-ranking-produtos", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_ranking_produtos", {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
        p_limit: 20,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportarCSV = () => {
    const csv = [
      "Modelo;Capacidade;Qtd vendida;Faturamento;Pedidos;Preço médio",
      ...data.map(
        (d: any) =>
          `"${d.modelo}";"${d.capacidade ?? ""}";${d.qtd_vendida};${d.faturamento};${d.qtd_pedidos};${d.preco_medio}`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ranking-produtos.csv";
    a.click();
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Top 20 produtos mais vendidos</h2>
        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={!data.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      {!data.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Modelo</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Pedidos</th>
                <th className="p-2 text-right">Preço médio</th>
                <th className="p-2 text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d: any, i: number) => (
                <tr key={`${d.modelo}-${d.capacidade}-${i}`} className="border-t">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium">
                    {d.modelo} {d.capacidade ?? ""}
                  </td>
                  <td className="p-2 text-right">{d.qtd_vendida}</td>
                  <td className="p-2 text-right">{d.qtd_pedidos}</td>
                  <td className="p-2 text-right">{formatBRL(Number(d.preco_medio))}</td>
                  <td className="p-2 text-right font-semibold">
                    {formatBRL(Number(d.faturamento))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RelatorioGiro({ empresaId }: any) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["atacado-giro-estoque", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_giro_estoque", {
        p_empresa_id: empresaId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const parados = data.filter((d: any) => d.classificacao === "parado");
  const lentos = data.filter((d: any) => d.classificacao === "lento");
  const valorParado = parados.reduce(
    (s: number, d: any) => s + Number(d.valor_imobilizado),
    0
  );

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Itens parados (&gt;90d)</p>
          <p className="text-2xl font-bold text-destructive">{parados.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Giro lento (30-90d)</p>
          <p className="text-2xl font-bold text-warning">{lentos.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Capital imobilizado parado</p>
          <p className="text-2xl font-bold text-destructive">{formatBRL(valorParado)}</p>
        </Card>
      </div>

      <Card className="p-6">
        {!data.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem aparelhos em estoque
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Modelo</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Valor parado</th>
                  <th className="p-2 text-right">Dias estoque</th>
                  <th className="p-2 text-right">Vendas 30d</th>
                  <th className="p-2 text-right">Vendas 90d</th>
                  <th className="p-2">Classif.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.aparelho_id} className="border-t">
                    <td className="p-2 font-medium">
                      {d.modelo} {d.capacidade ?? ""} {d.cor ?? ""}
                    </td>
                    <td className="p-2 text-right">{d.quantidade_atual}</td>
                    <td className="p-2 text-right font-semibold">
                      {formatBRL(Number(d.valor_imobilizado))}
                    </td>
                    <td className="p-2 text-right">{d.dias_em_estoque}d</td>
                    <td className="p-2 text-right">{d.qtd_vendida_30d}</td>
                    <td className="p-2 text-right">{d.qtd_vendida_90d}</td>
                    <td className="p-2">
                      <Badge
                        variant="outline"
                        className={
                          d.classificacao === "parado"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : d.classificacao === "lento"
                            ? "bg-warning/15 text-warning border-warning/30"
                            : "bg-success/15 text-success border-success/30"
                        }
                      >
                        {d.classificacao}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function RelatorioRFM({ empresaId }: any) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["atacado-rfm", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_rfm_clientes", {
        p_empresa_id: empresaId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const grupos = data.reduce((acc: any, c: any) => {
    acc[c.classificacao] = (acc[c.classificacao] ?? 0) + 1;
    return acc;
  }, {});

  const cores: Record<string, string> = {
    campeao: "bg-success/15 text-success border-success/30",
    leal: "bg-primary/15 text-primary border-primary/30",
    recente: "bg-info/15 text-info border-info/30",
    em_risco: "bg-warning/15 text-warning border-warning/30",
    perdido: "bg-destructive/15 text-destructive border-destructive/30",
    sem_compras: "bg-muted text-muted-foreground border-border",
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Object.keys(cores).map((k) => (
          <Card key={k} className="p-3">
            <p className="text-xs text-muted-foreground capitalize">{k.replace("_", " ")}</p>
            <p className="text-xl font-bold">{grupos[k] ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        {!data.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem clientes cadastrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Última compra</th>
                  <th className="p-2 text-right">Sem comprar</th>
                  <th className="p-2 text-right">Pedidos 12m</th>
                  <th className="p-2 text-right">Faturamento</th>
                  <th className="p-2">Classif.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c: any) => (
                  <tr key={c.cliente_id} className="border-t">
                    <td className="p-2 font-medium">
                      {c.nome_fantasia || c.razao_social}
                    </td>
                    <td className="p-2">
                      {c.ultima_compra
                        ? new Date(c.ultima_compra).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="p-2 text-right">{c.dias_sem_comprar}d</td>
                    <td className="p-2 text-right">{c.qtd_pedidos_12m}</td>
                    <td className="p-2 text-right font-semibold">
                      {formatBRL(Number(c.faturamento_12m))}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className={cores[c.classificacao]}>
                        {c.classificacao.replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Linha({ label, valor, bold, large, cor }: any) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 ${
        large ? "py-3 bg-muted/30" : ""
      }`}
    >
      <span
        className={`${bold ? "font-semibold" : "text-muted-foreground"} ${
          large ? "text-base" : "text-sm"
        }`}
      >
        {label}
      </span>
      <span
        className={`${bold ? "font-bold" : ""} ${large ? "text-lg" : "text-sm"} ${cor ?? ""}`}
      >
        {valor < 0 ? `−${formatBRL(Math.abs(valor))}` : formatBRL(valor)}
      </span>
    </div>
  );
}

function KpiSmall({ label, valor, danger }: any) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${danger ? "text-destructive" : ""}`}>{valor}</p>
    </div>
  );
}
