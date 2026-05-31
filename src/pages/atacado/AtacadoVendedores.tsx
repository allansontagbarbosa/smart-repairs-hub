import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoVendedores() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [comissaoOpen, setComissaoOpen] = useState<any>(null);

  const hoje = new Date();
  const inicio = `${hoje.getFullYear()}-${String(
    hoje.getMonth() + 1
  ).padStart(2, "0")}-01`;
  const fim = hoje.toISOString().slice(0, 10);

  const { data: performance = [], isLoading } = useQuery({
    queryKey: ["atacado-performance-vendedores", empresaId, inicio, fim],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_performance_vendedores", {
        p_empresa_id: empresaId!,
        p_inicio: inicio,
        p_fim: fim,
      });
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["atacado-comissoes-regras", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_comissoes")
        .select("*")
        .eq("empresa_id", empresaId!);
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const totalComissao = performance.reduce(
    (s: number, p: any) => s + Number(p.comissao_estimada),
    0
  );
  const totalFaturamento = performance.reduce(
    (s: number, p: any) => s + Number(p.faturamento),
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendedores B2B</h1>
        <p className="text-sm text-muted-foreground">
          Performance, ranking e regras de comissão (mês atual)
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vendedores ativos" valor={performance.length} />
        <Kpi label="Faturamento total (mês)" valor={formatBRL(totalFaturamento)} />
        <Kpi label="Comissões a pagar" valor={formatBRL(totalComissao)} />
        <Kpi
          label="% do faturamento"
          valor={`${
            totalFaturamento > 0
              ? ((totalComissao / totalFaturamento) * 100).toFixed(1)
              : "0"
          }%`}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : performance.length === 0 ? (
        <AtacadoEmptyState
          icon={Briefcase}
          title="Sem dados de vendedores"
          description="Quando houver pedidos faturados com vendedor atribuído, eles aparecem aqui."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Vendedor</th>
                <th className="text-right px-4 py-2">Pedidos</th>
                <th className="text-right px-4 py-2">Faturamento</th>
                <th className="text-right px-4 py-2">Ticket médio</th>
                <th className="text-right px-4 py-2">Novos clientes</th>
                <th className="text-right px-4 py-2">Comissão</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {performance.map((v: any, i: number) => {
                const regra = regras.find(
                  (r: any) => r.vendedor_id === v.vendedor_id
                );
                const medal =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                return (
                  <tr key={v.vendedor_id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg w-8 text-center">{medal}</span>
                        <div>
                          <div className="font-medium">{v.nome}</div>
                          {regra ? (
                            <div className="text-xs text-muted-foreground">
                              Comissão: {regra.pct_padrao}% padrão
                              {regra.pct_acima_meta
                                ? ` · ${regra.pct_acima_meta}% acima meta`
                                : ""}
                            </div>
                          ) : (
                            <div className="text-xs text-warning">
                              ⚠ Sem regra de comissão
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{v.qtd_pedidos}</td>
                    <td className="px-4 py-3 text-right">
                      {formatBRL(Number(v.faturamento))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatBRL(Number(v.ticket_medio))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.novos_clientes > 0 ? (
                        <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                          +{v.novos_clientes}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatBRL(Number(v.comissao_estimada))}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setComissaoOpen({ vendedor: v, regra })
                        }
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comissaoOpen && (
        <RegraComissaoDialog
          vendedor={comissaoOpen.vendedor}
          regra={comissaoOpen.regra}
          empresaId={empresaId!}
          onClose={() => setComissaoOpen(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["atacado-comissoes-regras"] });
            qc.invalidateQueries({
              queryKey: ["atacado-performance-vendedores"],
            });
            toast({ title: "✓ Regra salva" });
            setComissaoOpen(null);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, valor }: any) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold mt-1">{valor}</div>
    </div>
  );
}

function RegraComissaoDialog({
  vendedor,
  regra,
  empresaId,
  onClose,
  onSaved,
}: any) {
  const [pctPadrao, setPctPadrao] = useState(
    String(regra?.pct_padrao ?? "2")
  );
  const [pctAcimaMeta, setPctAcimaMeta] = useState(
    regra?.pct_acima_meta != null ? String(regra.pct_acima_meta) : ""
  );
  const [pctClienteNovo, setPctClienteNovo] = useState(
    regra?.pct_cliente_novo != null ? String(regra.pct_cliente_novo) : ""
  );
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        vendedor_id: vendedor.vendedor_id,
        pct_padrao: parseFloat(pctPadrao.replace(",", ".")) || 2,
        pct_acima_meta: pctAcimaMeta
          ? parseFloat(pctAcimaMeta.replace(",", "."))
          : null,
        pct_cliente_novo: pctClienteNovo
          ? parseFloat(pctClienteNovo.replace(",", "."))
          : null,
        ativa: true,
      };

      if (regra?.id) {
        await supabase
          .from("atacado_comissoes")
          .update(payload)
          .eq("id", regra.id);
      } else {
        await supabase.from("atacado_comissoes").insert(payload);
      }
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regras de comissão — {vendedor.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>% padrão (sobre faturamento)</Label>
            <Input
              value={pctPadrao}
              onChange={(e) => setPctPadrao(e.target.value)}
              placeholder="2.0"
            />
            <p className="text-xs text-muted-foreground">
              Padrão recomendado: 2-3% no atacado
            </p>
          </div>
          <div className="space-y-1">
            <Label>% bônus acima da meta (opcional)</Label>
            <Input
              value={pctAcimaMeta}
              onChange={(e) => setPctAcimaMeta(e.target.value)}
              placeholder="ex: 4"
            />
          </div>
          <div className="space-y-1">
            <Label>% extra em 1º pedido de cliente novo (opcional)</Label>
            <Input
              value={pctClienteNovo}
              onChange={(e) => setPctClienteNovo(e.target.value)}
              placeholder="ex: 5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
