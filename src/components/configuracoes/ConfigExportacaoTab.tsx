import { useState } from "react";
import { Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(";"), ...rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const exports = [
  {
    id: "produtos", title: "Produtos Base", icon: FileSpreadsheet,
    fn: async () => {
      const { data } = await supabase.from("produtos_base").select("nome, sku, custo, preco_padrao, preco_especial, descricao, ativo");
      if (!data?.length) { toast.error("Sem dados"); return; }
      downloadCSV("produtos.csv", ["Nome", "SKU", "Custo", "Preço Padrão", "Preço Especial", "Descrição", "Ativo"],
        data.map((p) => [p.nome, p.sku || "", String(p.custo || 0), String(p.preco_padrao || 0), String(p.preco_especial || ""), p.descricao || "", p.ativo ? "Sim" : "Não"]));
      toast.success("Exportado!");
    },
  },
  {
    id: "servicos", title: "Serviços", icon: FileSpreadsheet,
    fn: async () => {
      const { data } = await supabase.from("tipos_servico").select("nome, descricao, valor_padrao, comissao_padrao, ativo");
      if (!data?.length) { toast.error("Sem dados"); return; }
      downloadCSV("servicos.csv", ["Nome", "Descrição", "Valor Padrão", "Comissão Padrão", "Ativo"],
        data.map((s) => [s.nome, s.descricao || "", String(s.valor_padrao || 0), String(s.comissao_padrao || 0), s.ativo ? "Sim" : "Não"]));
      toast.success("Exportado!");
    },
  },
  {
    id: "fornecedores", title: "Fornecedores", icon: FileSpreadsheet,
    fn: async () => {
      const { data } = await supabase.from("fornecedores").select("nome, responsavel, telefone, whatsapp, email, cnpj_cpf, endereco, categoria, prazo_medio, ativo");
      if (!data?.length) { toast.error("Sem dados"); return; }
      downloadCSV("fornecedores.csv", ["Nome", "Responsável", "Telefone", "WhatsApp", "Email", "CNPJ/CPF", "Endereço", "Categoria", "Prazo Médio", "Ativo"],
        data.map((f) => [f.nome, f.responsavel || "", f.telefone || "", f.whatsapp || "", f.email || "", f.cnpj_cpf || "", f.endereco || "", f.categoria || "", f.prazo_medio || "", f.ativo ? "Sim" : "Não"]));
      toast.success("Exportado!");
    },
  },
  {
    id: "estoque", title: "Estoque", icon: FileSpreadsheet,
    fn: async () => {
      const { data } = await supabase.from("estoque_itens").select("nome_personalizado, tipo_item, sku, imei_serial, quantidade, quantidade_minima, custo_unitario, preco_venda, local_estoque, status").is("deleted_at", null);
      if (!data?.length) { toast.error("Sem dados"); return; }
      downloadCSV("estoque.csv", ["Nome", "Tipo", "SKU", "IMEI/Serial", "Quantidade", "Qtd Mínima", "Custo", "Preço Venda", "Local", "Status"],
        data.map((e) => [e.nome_personalizado || "", e.tipo_item, e.sku || "", e.imei_serial || "", String(e.quantidade), String(e.quantidade_minima), String(e.custo_unitario || 0), String(e.preco_venda || 0), e.local_estoque || "", e.status]));
      toast.success("Exportado!");
    },
  },
];

export function ConfigExportacaoTab() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (exp: typeof exports[0]) => {
    setLoading(exp.id);
    try { await exp.fn(); } catch { toast.error("Erro na exportação"); }
    setLoading(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Exporte os dados cadastrais do sistema em formato CSV para uso em planilhas.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {exports.map((exp) => (
          <Card key={exp.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <exp.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{exp.title}</div>
                  <div className="text-xs text-muted-foreground">Exportar como CSV</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleExport(exp)} disabled={loading === exp.id}>
                {loading === exp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Exportar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Importar Dados</div>
              <div className="text-xs text-muted-foreground">Importação via planilha (em breve)</div>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled>
            <Upload className="h-4 w-4 mr-1" />Em breve
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
