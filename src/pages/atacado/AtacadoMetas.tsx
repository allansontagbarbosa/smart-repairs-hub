import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Trophy, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

const LABELS: Record<string, { label: string; isCurrency: boolean }> = {
  faturamento: { label: "Faturamento", isCurrency: true },
  qtd_pedidos: { label: "Quantidade de pedidos", isCurrency: false },
  ticket_medio: { label: "Ticket médio", isCurrency: true },
  novos_clientes: { label: "Novos clientes", isCurrency: false },
};

export default function AtacadoMetas() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [novaOpen, setNovaOpen] = useState(false);

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const { data: progresso = [], isLoading } = useQuery({
    queryKey: ["atacado-progresso-metas", empresaId, ano, mes],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_progresso_metas", {
        p_empresa_id: empresaId!,
        p_ano: ano,
        p_mes: mes,
      });
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Metas Atacado</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {hoje.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Definir meta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : progresso.length === 0 ? (
        <AtacadoEmptyState
          icon={Target}
          title="Nenhuma meta definida para este mês"
          description="Defina metas de faturamento, pedidos ou novos clientes pra acompanhar a evolução."
          ctaLabel="Definir meta"
          ctaOnClick={() => setNovaOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {progresso.map((m: any) => {
            const cfg = LABELS[m.tipo];
            const pct = Number(m.pct_atingido) || 0;
            const atingido = pct >= 100;
            const corBar =
              pct >= 100
                ? "bg-success"
                : pct >= 70
                ? "bg-primary"
                : pct >= 40
                ? "bg-warning"
                : "bg-destructive";

            return (
              <div
                key={m.meta_id}
                className={`border rounded-lg p-4 space-y-3 ${
                  atingido ? "border-success/40 bg-success/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold flex items-center gap-2">
                    {atingido && <Trophy className="h-4 w-4 text-success" />}
                    {cfg?.label ?? m.tipo}
                  </div>
                  {atingido && (
                    <Badge className="bg-success text-success-foreground">
                      ATINGIDA ✓
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Realizado
                    </div>
                    <div className="font-semibold">
                      {cfg?.isCurrency
                        ? formatBRL(Number(m.valor_realizado))
                        : Math.floor(Number(m.valor_realizado))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Meta</div>
                    <div className="font-semibold">
                      {cfg?.isCurrency
                        ? formatBRL(Number(m.valor_meta))
                        : Math.floor(Number(m.valor_meta))}
                    </div>
                  </div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${corBar} transition-all`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{pct.toFixed(1)}%</span>
                  {m.bonus_atingir && atingido && (
                    <span className="text-success">
                      Bônus: {formatBRL(Number(m.bonus_atingir))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {novaOpen && (
        <NovaMetaDialog
          onClose={() => setNovaOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["atacado-progresso-metas"] });
            setNovaOpen(false);
            toast({ title: "✓ Meta criada" });
          }}
          empresaId={empresaId!}
          ano={ano}
          mes={mes}
        />
      )}
    </div>
  );
}

function NovaMetaDialog({ onClose, onSaved, empresaId, ano, mes }: any) {
  const [tipo, setTipo] = useState("faturamento");
  const [valorMeta, setValorMeta] = useState("");
  const [bonus, setBonus] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await supabase.from("atacado_metas").insert({
        empresa_id: empresaId,
        competencia_ano: ano,
        competencia_mes: mes,
        tipo,
        valor_meta: parseFloat(valorMeta.replace(",", ".")) || 0,
        bonus_atingir: bonus ? parseFloat(bonus.replace(",", ".")) : null,
      });
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
          <DialogTitle>Nova meta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">Faturamento (R$)</SelectItem>
                <SelectItem value="qtd_pedidos">
                  Quantidade de pedidos
                </SelectItem>
                <SelectItem value="ticket_medio">Ticket médio (R$)</SelectItem>
                <SelectItem value="novos_clientes">Novos clientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor da meta</Label>
            <Input
              value={valorMeta}
              onChange={(e) => setValorMeta(e.target.value)}
              placeholder="ex: 50000"
            />
          </div>
          <div className="space-y-1">
            <Label>Bônus ao atingir (opcional)</Label>
            <Input
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              placeholder="ex: 500,00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
