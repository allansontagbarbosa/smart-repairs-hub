import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Wallet,
  Phone,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Calendar,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoCobranca() {
  const { empresaId } = useEmpresa();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drawerClienteId, setDrawerClienteId] = useState<string | null>(null);
  const [registrandoCobranca, setRegistrandoCobranca] = useState<any | null>(null);
  const [tipoCobranca, setTipoCobranca] = useState("whatsapp");
  const [descricaoCobranca, setDescricaoCobranca] = useState("");
  const [resultadoCobranca, setResultadoCobranca] = useState("sem_contato");
  const [proximaAcao, setProximaAcao] = useState("");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["atacado-clientes-inadimplentes", empresaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_clientes_inadimplentes" as any, {
        p_empresa_id: empresaId,
      });
      return (data ?? []) as any[];
    },
    enabled: !!empresaId,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["historico-cobranca", drawerClienteId],
    queryFn: async () => {
      if (!drawerClienteId) return [];
      const { data } = await supabase
        .from("atacado_cobrancas_historico" as any)
        .select(`*, funcionario:funcionarios!realizado_por(nome)`)
        .eq("cliente_id", drawerClienteId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
    enabled: !!drawerClienteId,
  });

  const enviarWhatsapp = (cliente: any) => {
    const tel = cliente.telefone?.replace(/\D/g, "");
    if (!tel) {
      toast({ title: "Cliente sem telefone", variant: "destructive" });
      return;
    }
    const msg = encodeURIComponent(
      `Olá! Aqui é da Ditt cobrança.\n\nIdentificamos que há ${formatBRL(
        Number(cliente.total_atrasado)
      )} em aberto vencido há ${cliente.dias_max_atraso} dias.\n\nPodemos ajudar com pagamento via Pix ou negociar o débito?\n\nAguardamos retorno.`
    );
    const tel55 = tel.length >= 10 ? `55${tel}` : tel;
    window.open(`https://wa.me/${tel55}?text=${msg}`, "_blank");
    setRegistrandoCobranca({ ...cliente, tipo_sugerido: "whatsapp" });
    setTipoCobranca("whatsapp");
  };

  const registrar = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { error } = await supabase.from("atacado_cobrancas_historico" as any).insert({
        empresa_id: empresaId,
        cliente_id: registrandoCobranca.cliente_id || registrandoCobranca.id,
        tipo: tipoCobranca,
        descricao: descricaoCobranca || null,
        resultado: resultadoCobranca,
        data_proxima_acao: proximaAcao || null,
        realizado_por: profile?.funcionario_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Cobrança registrada" });
      qc.invalidateQueries({ queryKey: ["atacado-clientes-inadimplentes"] });
      qc.invalidateQueries({ queryKey: ["historico-cobranca"] });
      setRegistrandoCobranca(null);
      setDescricaoCobranca("");
      setProximaAcao("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const totalAtrasado = clientes.reduce(
    (s: number, c: any) => s + Number(c.total_atrasado),
    0
  );

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cobrança Ativa</h1>
        <p className="text-sm text-muted-foreground">
          Clientes inadimplentes ordenados por gravidade
        </p>
      </div>

      <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <div>
          <div className="text-lg font-bold text-destructive tabular-nums">
            {formatBRL(totalAtrasado)} em atraso
          </div>
          <div className="text-xs text-muted-foreground">
            {clientes.length} cliente(s) inadimplente(s)
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <AtacadoEmptyState
          icon={Wallet}
          title="Sem inadimplentes 🎉"
          description="Nenhum cliente em atraso no momento."
        />
      ) : (
        <div className="space-y-3">
          {clientes.map((c: any) => (
            <div
              key={c.cliente_id}
              className="bg-card border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{c.nome_fantasia || c.razao_social}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.telefone || "Sem telefone"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-destructive tabular-nums">
                    {formatBRL(Number(c.total_atrasado))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.qtd_boletos_atrasados} boleto(s) · +{c.dias_max_atraso}d
                  </div>
                </div>
              </div>

              {c.ultimo_contato && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Último contato: <strong>{c.ultimo_tipo}</strong> em{" "}
                  {new Date(c.ultimo_contato).toLocaleDateString("pt-BR")}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => enviarWhatsapp(c)}>
                  <MessageSquare className="h-3 w-3" /> WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRegistrandoCobranca({ ...c, tipo_sugerido: "ligacao" });
                    setTipoCobranca("ligacao");
                  }}
                >
                  <Phone className="h-3 w-3" /> Registrar ligação
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDrawerClienteId(c.cliente_id)}
                >
                  <History className="h-3 w-3" /> Histórico
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer histórico */}
      <Sheet open={!!drawerClienteId} onOpenChange={(v) => !v && setDrawerClienteId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico de cobranças</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {historico.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Sem cobranças registradas ainda.
              </div>
            ) : (
              historico.map((h: any) => (
                <div key={h.id} className="bg-muted/30 border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{h.tipo}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {h.descricao && <p className="text-sm">{h.descricao}</p>}
                  {h.resultado && (
                    <div className="text-xs text-muted-foreground">
                      Resultado: <strong>{h.resultado}</strong>
                      {h.funcionario?.nome && <> · por {h.funcionario.nome}</>}
                    </div>
                  )}
                  {h.data_proxima_acao && (
                    <div className="text-xs flex items-center gap-1 text-warning">
                      <Calendar className="h-3 w-3" /> Próx. ação:{" "}
                      {new Date(h.data_proxima_acao).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog registrar cobrança */}
      <Dialog
        open={!!registrandoCobranca}
        onOpenChange={(v) => !v && setRegistrandoCobranca(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar cobrança</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-muted/30 rounded">
              <div className="font-semibold">
                {registrandoCobranca?.nome_fantasia || registrandoCobranca?.razao_social}
              </div>
              <div className="text-sm text-destructive tabular-nums">
                {formatBRL(Number(registrandoCobranca?.total_atrasado ?? 0))} em atraso
              </div>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={tipoCobranca} onValueChange={setTipoCobranca}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="acordo">Acordo de renegociação</SelectItem>
                  <SelectItem value="observacao">Observação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Resultado</Label>
              <Select value={resultadoCobranca} onValueChange={setResultadoCobranca}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagou">Pagou</SelectItem>
                  <SelectItem value="prometeu">Prometeu pagar</SelectItem>
                  <SelectItem value="sem_contato">Sem contato</SelectItem>
                  <SelectItem value="recusou">Recusou</SelectItem>
                  <SelectItem value="acordo_feito">Acordo feito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={descricaoCobranca}
                onChange={(e) => setDescricaoCobranca(e.target.value)}
                placeholder="O cliente prometeu pagar 50% até 6ª feira..."
                rows={2}
              />
            </div>

            <div>
              <Label>Agendar próxima ação (opcional)</Label>
              <Input
                type="date"
                value={proximaAcao}
                onChange={(e) => setProximaAcao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrandoCobranca(null)}>
              Cancelar
            </Button>
            <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>
              {registrar.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "✓ Registrar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
