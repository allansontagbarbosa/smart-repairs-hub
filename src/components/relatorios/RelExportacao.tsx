import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, FileText, Printer } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function downloadCSV(filename: string, headers: string[], rows: any[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelExportacao() {
  const [dataInicio, setDataInicio] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [loading, setLoading] = useState("");

  async function exportarOS() {
    setLoading("os");
    try {
      const { data, count } = await supabase
        .from("ordens_de_servico")
        .select("numero, status, data_entrada, data_conclusao, data_entrega, defeito_relatado, diagnostico, servico_realizado, valor, custo_pecas, tecnico, prioridade, observacoes", { count: "exact" })
        .is("deleted_at", null)
        .gte("data_entrada", dataInicio.toISOString())
        .lte("data_entrada", dataFim.toISOString())
        .order("data_entrada", { ascending: false });

      if (!data?.length) { toast.info("Nenhuma OS no período."); return; }
      if ((count ?? 0) > 500 && !confirm(`Exportar ${count} OSs? Pode levar alguns segundos.`)) return;

      downloadCSV(
        `os_${format(dataInicio, "yyyy-MM-dd")}_${format(dataFim, "yyyy-MM-dd")}.csv`,
        ["Número","Status","Data Entrada","Data Conclusão","Data Entrega","Defeito","Diagnóstico","Serviço","Valor","Custo Peças","Técnico","Prioridade","Obs"],
        data.map(o => [o.numero, o.status, o.data_entrada, o.data_conclusao, o.data_entrega, o.defeito_relatado, o.diagnostico, o.servico_realizado, o.valor, o.custo_pecas, o.tecnico, o.prioridade, o.observacoes])
      );
      toast.success(`CSV de ${data.length} OSs exportado!`);
    } finally { setLoading(""); }
  }

  async function exportarClientes() {
    setLoading("clientes");
    try {
      const { data } = await supabase.from("clientes").select("nome, telefone, whatsapp, email, cpf, documento, observacoes, created_at").is("deleted_at", null).order("nome");
      if (!data?.length) { toast.info("Nenhum cliente."); return; }
      downloadCSV(
        "clientes.csv",
        ["Nome","Telefone","WhatsApp","Email","CPF","Documento","Obs","Criado em"],
        data.map(c => [c.nome, c.telefone, c.whatsapp, c.email, c.cpf, c.documento, c.observacoes, c.created_at])
      );
      toast.success(`CSV de ${data.length} clientes exportado!`);
    } finally { setLoading(""); }
  }

  async function exportarEstoque() {
    setLoading("estoque");
    try {
      const { data } = await supabase.from("estoque_itens").select("sku, nome_personalizado, tipo_item, quantidade, quantidade_minima, custo_unitario, local_estoque, fornecedor, status").is("deleted_at", null).order("nome_personalizado");
      if (!data?.length) { toast.info("Nenhum item no estoque."); return; }
      downloadCSV(
        "estoque.csv",
        ["SKU","Nome","Tipo","Quantidade","Qtd Mínima","Custo Unit","Local","Fornecedor","Status"],
        data.map(e => [e.sku, e.nome_personalizado, e.tipo_item, e.quantidade, e.quantidade_minima, e.custo_unitario, e.local_estoque, e.fornecedor, e.status])
      );
      toast.success(`CSV de ${data.length} itens exportado!`);
    } finally { setLoading(""); }
  }

  async function exportarComissoes() {
    setLoading("comissoes");
    try {
      const ini = dataInicio.toISOString();
      const fi = dataFim.toISOString();
      const mesIni = format(dataInicio, "yyyy-MM");
      const mesFi = format(dataFim, "yyyy-MM");
      // Pendente/Liberada: por mes_competencia (regime de competência)
      // Paga: por data_pagamento (regime de caixa)
      const [pendLib, pagas] = await Promise.all([
        supabase.from("comissoes")
          .select("valor, valor_base, tipo, status, mes_competencia, data_pagamento, created_at, observacoes, funcionarios(nome)")
          .is("estornada_em", null)
          .in("status", ["pendente", "liberada"])
          .gte("mes_competencia", mesIni)
          .lte("mes_competencia", mesFi),
        supabase.from("comissoes")
          .select("valor, valor_base, tipo, status, mes_competencia, data_pagamento, created_at, observacoes, funcionarios(nome)")
          .is("estornada_em", null)
          .eq("status", "paga")
          .gte("data_pagamento", ini)
          .lte("data_pagamento", fi),
      ]);
      const data = [...(pendLib.data ?? []), ...(pagas.data ?? [])];
      if (!data.length) { toast.info("Nenhuma comissão no período."); return; }
      downloadCSV(
        `comissoes_${format(dataInicio, "yyyy-MM-dd")}_${format(dataFim, "yyyy-MM-dd")}.csv`,
        ["Funcionário","Valor","Valor Base","Tipo","Status","Mês Competência","Data Pagamento","Obs","Criada em"],
        data.map((c: any) => [c.funcionarios?.nome, c.valor, c.valor_base, c.tipo, c.status, c.mes_competencia, c.data_pagamento, c.observacoes, c.created_at])
      );
      toast.success(`CSV de ${data.length} comissões exportado!`);
    } finally { setLoading(""); }
  }

  async function exportarTecnicos() {
    setLoading("tecnicos");
    try {
      const { data } = await supabase.rpc("kpi_tecnicos" as any, {
        p_inicio: dataInicio.toISOString(),
        p_fim: dataFim.toISOString(),
      });
      const lista = (data as any)?.tecnicos ?? [];
      if (!lista.length) { toast.info("Nenhum técnico no período."); return; }
      downloadCSV(
        `tecnicos_${format(dataInicio,"yyyy-MM-dd")}_${format(dataFim,"yyyy-MM-dd")}.csv`,
        ["Técnico","Serviços","OSs","Faturamento (R$)","Ticket médio (R$)","Tempo médio (h)","Pendente (R$)","Liberada (R$)","Paga (R$)","A receber (R$)"],
        lista.map((t: any) => [
          t.nome, t.qtd_servicos, t.qtd_os,
          Number(t.faturamento_os).toFixed(2),
          Number(t.ticket_medio_os).toFixed(2),
          Number(t.tempo_medio_horas).toFixed(1),
          Number(t.comissao_pendente).toFixed(2),
          Number(t.comissao_liberada).toFixed(2),
          Number(t.comissao_paga).toFixed(2),
          Number(t.comissao_total_a_receber).toFixed(2),
        ])
      );
      toast.success(`CSV de ${lista.length} técnicos exportado!`);
    } finally { setLoading(""); }
  }

  async function exportarSaldoB2B() {
    setLoading("saldo");
    try {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .not("lojista_id", "is", null)
        .is("deleted_at", null);
      if (!clientes?.length) { toast.info("Nenhum cliente B2B."); return; }
      const linhas = await Promise.all(clientes.map(async (c) => {
        const { data: saldo } = await supabase.rpc("get_saldo_cliente" as any, { p_cliente_id: c.id });
        const s = saldo as any;
        return [
          c.nome, c.telefone ?? "",
          Number(s?.total_faturado ?? 0).toFixed(2),
          Number(s?.total_recebido ?? 0).toFixed(2),
          Number(s?.saldo_devedor ?? 0).toFixed(2),
          s?.qtd_oss ?? 0,
          s?.ultima_os_data ?? "",
          s?.ultimo_pagamento_data ?? "",
        ];
      }));
      downloadCSV(
        `saldo_b2b_${format(new Date(),"yyyy-MM-dd")}.csv`,
        ["Cliente","Telefone","Total Faturado (R$)","Total Recebido (R$)","Saldo Devedor (R$)","Qtd OSs","Última OS","Último Pagamento"],
        linhas
      );
      toast.success(`CSV de ${linhas.length} clientes B2B exportado!`);
    } finally { setLoading(""); }
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Period filter */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtro de Período</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>Data início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataInicio, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={d => d && setDataInicio(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label>Data fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataFim, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={d => d && setDataFim(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Ordens de Serviço</p>
              <p className="text-xs text-muted-foreground">Exportar OS do período selecionado</p>
            </div>
            <Button onClick={exportarOS} disabled={loading === "os"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Clientes</p>
              <p className="text-xs text-muted-foreground">Todos os clientes ativos</p>
            </div>
            <Button onClick={exportarClientes} disabled={loading === "clientes"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Estoque Atual</p>
              <p className="text-xs text-muted-foreground">Todos os itens do estoque</p>
            </div>
            <Button onClick={exportarEstoque} disabled={loading === "estoque"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Comissões</p>
              <p className="text-xs text-muted-foreground">Comissões do período para folha de pagamento</p>
            </div>
            <Button onClick={exportarComissoes} disabled={loading === "comissoes"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Técnicos</p>
              <p className="text-xs text-muted-foreground">Desempenho consolidado por técnico</p>
            </div>
            <Button onClick={exportarTecnicos} disabled={loading === "tecnicos"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">Saldo B2B</p>
              <p className="text-xs text-muted-foreground">Saldo devedor por cliente lojista</p>
            </div>
            <Button onClick={exportarSaldoB2B} disabled={loading === "saldo"} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-medium">DRE do Mês</p>
              <p className="text-xs text-muted-foreground">Imprimir demonstrativo como PDF</p>
            </div>
            <Button onClick={() => { window.location.href = "/relatorios?tab=dre&print=1"; }} variant="outline">
              <Printer className="h-4 w-4 mr-1" /> PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
