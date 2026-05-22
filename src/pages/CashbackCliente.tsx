import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);

const categoriaEmoji: Record<string, string> = {
  tela: "📱", bateria: "🔋", camera: "📷", audio: "🔉",
  biometria: "👆", botoes: "🔘", conector: "🔌", fisico: "🛠️",
  geral: "📦", software: "💾", sem_categoria: "❓",
};

export default function CashbackCliente() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cashback-cliente", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashback_get_cliente_config" as any, { p_cliente_id: id });
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (data?.ativacao?.observacoes) setObs(data.ativacao.observacoes);
  }, [data?.ativacao?.observacoes]);

  const toggleAtivo = useMutation({
    mutationFn: async (ativar: boolean) => {
      const { error } = await supabase.rpc("cashback_ativar_cliente" as any, {
        p_cliente_id: id, p_ativar: ativar, p_observacoes: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-cliente", id] });
      toast({ title: "Atualizado" });
    },
  });

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;
  if (data?.erro) return <div className="container mx-auto p-6">Cliente não encontrado</div>;

  const ativo = !!data?.ativacao?.ativo;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => nav("/cashback")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl">{data?.cliente?.nome}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data?.cliente?.tipo_cliente}{data?.cliente?.grupo_nome ? ` · ${data.cliente.grupo_nome}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{ativo ? "Cashback ATIVO" : "Inativo"}</span>
              <Switch checked={ativo} onCheckedChange={(v) => toggleAtivo.mutate(v)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="Observações (ex: negociação especial, ata 003/2026...)"
            value={obs} onChange={(e) => setObs(e.target.value)}
            onBlur={() => ativo && toggleAtivo.mutate(true)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas por categoria de serviço</CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina o percentual de cashback para cada categoria. Vazio = não ganha cashback nessa categoria.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.categorias ?? []).map((cat: any) => (
              <TaxaCategoriaRow key={cat.categoria} clienteId={id!} cat={cat} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Saldo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="text-2xl font-bold text-primary">{fmtC(data?.saldo?.centavos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total recebido</p>
              <p className="text-xl font-medium text-emerald-600">{fmtC(data?.saldo?.total_recebido_centavos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total usado</p>
              <p className="text-xl font-medium text-orange-600">{fmtC(data?.saldo?.total_usado_centavos)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxaCategoriaRow({ clienteId, cat }: { clienteId: string; cat: any }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState<string>(cat.percentual != null ? String(cat.percentual) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setValor(cat.percentual != null ? String(cat.percentual) : "");
  }, [cat.percentual]);

  useEffect(() => {
    const current = cat.percentual != null ? String(cat.percentual) : "";
    if (valor === current) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const num = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      if (num !== null && (isNaN(num) || num < 0 || num > 100)) {
        toast({ title: "Percentual inválido (0–100)", variant: "destructive" });
        setStatus("idle");
        return;
      }
      const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, {
        p_cliente_id: clienteId, p_categoria: cat.categoria, p_percentual: num,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setStatus("idle");
      } else {
        setStatus("saved");
        qc.invalidateQueries({ queryKey: ["cashback-cliente", clienteId] });
        setTimeout(() => setStatus("idle"), 1500);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="flex items-center gap-3 p-3 border rounded">
      <div className="text-xl w-8">{categoriaEmoji[cat.categoria] ?? "🔧"}</div>
      <div className="flex-1">
        <div className="font-medium capitalize">{cat.categoria.replace(/_/g, " ")}</div>
        <div className="text-xs text-muted-foreground">{cat.qtd_tipos_servico} tipos de serviço</div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number" step="0.01" min={0} max={100}
          value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder="—" className="w-24 text-right"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <div className="w-6">
          {status === "saving" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {status === "saved" && <Check className="w-4 h-4 text-emerald-600" />}
        </div>
        {cat.tem_taxa && <Badge variant="default" className="ml-1">ativa</Badge>}
      </div>
    </div>
  );
}
