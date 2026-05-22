import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Save, AlertTriangle } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);

type Modo = "automatico" | "manual" | "desabilitado";

export default function CashbackCustoOperacional() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [modo, setModo] = useState<Modo>("automatico");
  const [valorManual, setValorManual] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cashback-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cashback_empresa_dashboard" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const custoOp = data?.custo_operacional;

  useEffect(() => {
    if (custoOp?.modo) setModo(custoOp.modo as Modo);
    if (custoOp?.valor_centavos != null) {
      setValorManual((Number(custoOp.valor_centavos) / 100).toFixed(2));
    }
  }, [custoOp?.modo, custoOp?.valor_centavos]);

  const recalcular = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cashback_recalcular_custo_operacional" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      toast({ title: "Recalculado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const num = Number(valorManual.replace(",", "."));
      const centavos = modo === "manual" ? Math.round((isNaN(num) ? 0 : num) * 100) : 0;
      const { error } = await supabase.rpc("cashback_set_custo_operacional_manual" as any, {
        p_valor_centavos: centavos, p_modo: modo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      toast({ title: "Configuração salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;

  const decomp = custoOp?.decomposicao;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      <Button variant="ghost" onClick={() => nav("/cashback")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Custo operacional por OS</CardTitle>
              <p className="text-sm text-muted-foreground">
                Usado nas regras de cashback do tipo "percentual sobre LUCRO".
              </p>
            </div>
            <Badge variant={custoOp?.modo === "manual" ? "secondary" : custoOp?.modo === "desabilitado" ? "outline" : "default"}>
              {custoOp?.modo === "manual" ? "Manual" : custoOp?.modo === "desabilitado" ? "Desabilitado" : "Auto"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">{fmtC(custoOp?.valor_centavos)}<span className="text-sm text-muted-foreground font-normal"> / OS</span></p>
          {custoOp?.atualizado_em && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização: {new Date(custoOp.atualizado_em).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modo de cálculo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <div className="flex items-start gap-2 p-3 border rounded">
              <RadioGroupItem value="automatico" id="auto" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="auto" className="font-medium cursor-pointer">Automático</Label>
                <p className="text-xs text-muted-foreground">Calcula com base nos custos fixos e OS concluídas do mês anterior.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 border rounded">
              <RadioGroupItem value="manual" id="manual" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="manual" className="font-medium cursor-pointer">Manual</Label>
                <p className="text-xs text-muted-foreground">Admin define o valor fixo por OS.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 border rounded">
              <RadioGroupItem value="desabilitado" id="off" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="off" className="font-medium cursor-pointer">Desabilitado</Label>
                <p className="text-xs text-muted-foreground">Ignora custo operacional (R$ 0/OS) no cálculo do lucro.</p>
              </div>
            </div>
          </RadioGroup>

          {modo === "manual" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input type="number" step="0.01" min={0} value={valorManual}
                onChange={(e) => setValorManual(e.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">/ OS</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              <Save className="w-4 h-4 mr-2" /> Salvar
            </Button>
            {modo === "automatico" && (
              <Button variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                <RefreshCw className={`w-4 h-4 mr-2 ${recalcular.isPending ? "animate-spin" : ""}`} /> Recalcular agora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {modo === "automatico" && decomp && (
        <Card>
          <CardHeader><CardTitle className="text-base">Decomposição do cálculo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Mês de referência</span><span className="font-medium">{decomp.mes_referencia}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Custos fixos</span><span className="font-medium">{fmtC(decomp.custos_fixos_centavos)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">OS concluídas</span><span className="font-medium">{decomp.qtd_os_concluidas}</span></div>
            <div className="border-t pt-2 flex justify-between text-base">
              <span className="font-medium">Custo por OS</span>
              <span className="font-bold text-primary">{fmtC(decomp.custo_por_os_centavos)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <AlertTitle>Atenção auditoria</AlertTitle>
        <AlertDescription>
          O valor automático pode ficar distorcido em meses com marcação em lote de OS como "entregue".
          Se o valor não refletir a realidade, mude para Manual.
        </AlertDescription>
      </Alert>
    </div>
  );
}
