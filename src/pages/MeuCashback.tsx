import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { Wallet } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);

const tipoLabel: Record<string, string> = {
  credito_os: "Crédito (OS)",
  debito_uso_os: "Uso em OS",
  credito_ajuste: "Crédito manual",
  debito_ajuste: "Débito manual",
  debito_estorno_os: "Estorno",
};

export default function MeuCashback() {
  const { data, isLoading } = useQuery({
    queryKey: ["meu-cashback"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_meu_cashback" as any);
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-64" /></div>;
  if (data?.erro) {
    return <div className="container mx-auto p-6"><p className="text-muted-foreground">Cashback indisponível.</p></div>;
  }

  const ativo = !!data?.ativo;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Meu Cashback</h1>
        <Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Ativo" : "Inativo"}</Badge>
      </div>

      {!ativo ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              O cashback ainda não está habilitado para você. Fale com seu gerente comercial.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3"><Wallet className="w-6 h-6 text-primary" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo disponível</p>
                    <p className="text-4xl font-bold text-primary">{fmtC(data?.saldo_centavos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recebido este mês</span>
                  <span className="font-medium text-emerald-600">{fmtC(data?.recebido_mes_centavos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usado este mês</span>
                  <span className="font-medium text-orange-600">{fmtC(data?.usado_mes_centavos)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Total recebido</span>
                  <span className="font-medium">{fmtC(data?.total_recebido_centavos)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Suas taxas por categoria</CardTitle></CardHeader>
            <CardContent>
              {!(data?.taxas_por_categoria ?? []).length ? (
                <p className="text-sm text-muted-foreground">Nenhuma categoria configurada ainda.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {data.taxas_por_categoria.map((t: any) => (
                    <div key={t.categoria} className="flex justify-between items-center p-3 border rounded">
                      <span className="capitalize">{t.categoria.replace(/_/g, " ")}</span>
                      <Badge variant="default">{t.display ?? (t.percentual != null ? `${t.percentual}%` : "")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Extrato</CardTitle></CardHeader>
            <CardContent>
              {!(data?.extrato ?? []).length ? (
                <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.extrato.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{m.descricao}{m.ordem_numero ? ` (OS #${m.ordem_numero})` : ""}</TableCell>
                        <TableCell>
                          <Badge variant={m.tipo?.startsWith("credito") ? "default" : "secondary"}>
                            {tipoLabel[m.tipo] ?? m.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${m.tipo?.startsWith("credito") ? "text-emerald-600" : "text-orange-600"}`}>
                          {m.tipo?.startsWith("credito") ? "+" : "−"}{fmtC(m.valor_centavos)}
                        </TableCell>
                        <TableCell className="text-right">{fmtC(m.saldo_apos_centavos)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
