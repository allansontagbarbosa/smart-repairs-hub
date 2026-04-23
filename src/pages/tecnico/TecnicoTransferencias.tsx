import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTecnicoIdentidade, useMinhasOS } from "@/hooks/useTecnico";

export default function TecnicoTransferencias() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: minhasOS = [] } = useMinhasOS(identidade?.funcionario_id);
  const qc = useQueryClient();
  const [novaOpen, setNovaOpen] = useState(false);

  const { data: transferencias = [], refetch } = useQuery({
    queryKey: ["tecnico-transferencias", identidade?.funcionario_id],
    enabled: !!identidade?.funcionario_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("os_transferencias")
        .select(`*, ordens_de_servico ( numero, numero_formatado, defeito_relatado, aparelhos ( marca, modelo ) )`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const recebidas = transferencias.filter((t: any) => t.funcionario_destino_id === identidade?.funcionario_id);
  const enviadas = transferencias.filter((t: any) => t.funcionario_origem_id === identidade?.funcionario_id);

  const responder = useMutation({
    mutationFn: async ({ id, status, ordem_id }: { id: string; status: "aceita" | "recusada"; ordem_id: string }) => {
      const { error } = await supabase.from("os_transferencias")
        .update({
          status,
          data_resposta: new Date().toISOString(),
          respondido_por: identidade?.user_id,
        }).eq("id", id);
      if (error) throw error;
      if (status === "aceita") {
        await supabase.from("ordens_de_servico").update({ funcionario_id: identidade?.funcionario_id }).eq("id", ordem_id);
      }
    },
    onSuccess: () => {
      toast({ title: "Resposta enviada" });
      refetch();
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transferências</h1>
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      <Tabs defaultValue="recebidas">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="recebidas">Recebidas {recebidas.filter((t: any) => t.status === "pendente").length > 0 && (
            <Badge className="ml-1.5">{recebidas.filter((t: any) => t.status === "pendente").length}</Badge>
          )}</TabsTrigger>
          <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
        </TabsList>

        <TabsContent value="recebidas" className="space-y-2 pt-3">
          {recebidas.length === 0 && <EmptyState text="Nenhuma transferência recebida." />}
          {recebidas.map((t: any) => (
            <TransferCard key={t.id} t={t}>
              {t.status === "pendente" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => responder.mutate({ id: t.id, status: "aceita", ordem_id: t.ordem_id })}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => responder.mutate({ id: t.id, status: "recusada", ordem_id: t.ordem_id })}>
                    <X className="h-3.5 w-3.5 mr-1" /> Recusar
                  </Button>
                </div>
              )}
            </TransferCard>
          ))}
        </TabsContent>

        <TabsContent value="enviadas" className="space-y-2 pt-3">
          {enviadas.length === 0 && <EmptyState text="Nenhuma transferência enviada." />}
          {enviadas.map((t: any) => <TransferCard key={t.id} t={t} />)}
        </TabsContent>
      </Tabs>

      <NovaTransferenciaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        minhasOS={minhasOS.filter(o => !["entregue", "cancelado"].includes(o.status))}
        identidade={identidade}
        onCreated={refetch}
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}

function TransferCard({ t, children }: { t: any; children?: React.ReactNode }) {
  const status = t.status as string;
  const statusVar = status === "aceita" ? "default" : status === "recusada" ? "destructive" : status === "cancelada" ? "secondary" : "outline";
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            #{t.ordens_de_servico?.numero_formatado || t.ordens_de_servico?.numero}
          </span>
          <Badge variant={statusVar as any} className="capitalize text-[10px]">{status}</Badge>
        </div>
        <p className="text-sm font-medium">
          {t.ordens_de_servico?.aparelhos?.marca} {t.ordens_de_servico?.aparelhos?.modelo}
        </p>
        {t.motivo && <p className="text-xs text-muted-foreground">{t.motivo}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

function NovaTransferenciaDialog({
  open, onOpenChange, minhasOS, identidade, onCreated,
}: any) {
  const [ordemId, setOrdemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-disponiveis", identidade?.empresa_id],
    enabled: !!identidade?.empresa_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("funcionarios")
        .select("id, nome, funcao, cargo")
        .eq("ativo", true)
        .is("deleted_at", null);
      return (data ?? []).filter((f: any) =>
        f.id !== identidade?.funcionario_id &&
        ((f.funcao || "").toLowerCase().includes("técnic") || (f.cargo || "").toLowerCase().includes("técnic"))
      );
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!ordemId || !destinoId) throw new Error("Selecione OS e técnico destino");
      const { error } = await supabase.from("os_transferencias").insert({
        ordem_id: ordemId,
        funcionario_origem_id: identidade.funcionario_id,
        funcionario_destino_id: destinoId,
        motivo: motivo.trim() || null,
        solicitado_por: identidade.user_id,
        status: "pendente",
        empresa_id: identidade.empresa_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Transferência solicitada" });
      onOpenChange(false);
      setOrdemId(""); setDestinoId(""); setMotivo("");
      onCreated();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar transferência</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>OS</Label>
            <Select value={ordemId} onValueChange={setOrdemId}>
              <SelectTrigger><SelectValue placeholder="Escolha a OS" /></SelectTrigger>
              <SelectContent>
                {minhasOS.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    #{o.numero_formatado || o.numero} — {o.aparelhos?.marca} {o.aparelhos?.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Técnico destino</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger><SelectValue placeholder="Escolha o técnico" /></SelectTrigger>
              <SelectContent>
                {tecnicos.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!ordemId || !destinoId}>
            <ArrowRight className="h-4 w-4 mr-1" /> Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
