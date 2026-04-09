import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaOrdemDialog({ open, onOpenChange, onSuccess }: Props) {
  const [showNewClient, setShowNewClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const queryClient = useQueryClient();

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Create new client inline
  const createClientMutation = useMutation({
    mutationFn: async (form: { nome: string; telefone: string }) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ nome: form.nome, telefone: form.telefone })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setSelectedClientId(data.id);
      setShowNewClient(false);
    },
  });

  // Create order
  const createOrderMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const clienteId = selectedClientId;
      if (!clienteId) throw new Error("Selecione um cliente");

      // Create device
      const { data: aparelho, error: apErr } = await supabase
        .from("aparelhos")
        .insert({
          cliente_id: clienteId,
          marca: fd.get("marca") as string,
          modelo: fd.get("modelo") as string,
          cor: (fd.get("cor") as string) || null,
          imei: (fd.get("imei") as string) || null,
        })
        .select()
        .single();
      if (apErr) throw apErr;

      // Create OS
      const valorStr = fd.get("valor") as string;
      const previsao = fd.get("previsao") as string;
      const dataEntrada = fd.get("data_entrada") as string;

      const { error: osErr } = await supabase.from("ordens_de_servico").insert({
        aparelho_id: aparelho.id,
        defeito_relatado: fd.get("defeito") as string,
        observacoes: (fd.get("observacoes") as string) || null,
        valor: valorStr ? parseFloat(valorStr) : null,
        previsao_entrega: previsao || null,
        data_entrada: dataEntrada || new Date().toISOString(),
        status: "recebido" as Status,
      });
      if (osErr) throw osErr;
    },
    onSuccess: () => {
      setSelectedClientId("");
      onOpenChange(false);
      onSuccess();
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createOrderMutation.mutate(new FormData(e.currentTarget));
  };

  const handleNewClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createClientMutation.mutate({
      nome: fd.get("novo_nome") as string,
      telefone: fd.get("novo_telefone") as string,
    });
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* ── Cliente ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-medium">Cliente</Label>
              <button
                type="button"
                onClick={() => setShowNewClient(!showNewClient)}
                className="inline-flex items-center gap-1 text-xs text-info hover:underline"
              >
                <UserPlus className="h-3 w-3" />
                {showNewClient ? "Cancelar" : "Novo cliente"}
              </button>
            </div>

            {showNewClient ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div onSubmit={handleNewClient} className="contents">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input name="novo_nome" required placeholder="Nome completo" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <Input name="novo_telefone" required placeholder="(00) 00000-0000" className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={createClientMutation.isPending}
                    onClick={(e) => {
                      const form = (e.target as HTMLElement).closest(".contents")!;
                      const nome = (form.querySelector('[name="novo_nome"]') as HTMLInputElement)?.value;
                      const telefone = (form.querySelector('[name="novo_telefone"]') as HTMLInputElement)?.value;
                      if (nome && telefone) createClientMutation.mutate({ nome, telefone });
                    }}
                  >
                    {createClientMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : null}
                    Cadastrar e selecionar
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} — {c.telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* ── Aparelho ── */}
          <div>
            <p className="text-xs font-medium mb-2">Aparelho</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Marca</Label><Input name="marca" required placeholder="Apple, Samsung..." className="mt-1 h-9" /></div>
              <div><Label className="text-xs text-muted-foreground">Modelo</Label><Input name="modelo" required placeholder="iPhone 15, S24..." className="mt-1 h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><Label className="text-xs text-muted-foreground">Cor (opcional)</Label><Input name="cor" placeholder="Preto, Branco..." className="mt-1 h-9" /></div>
              <div><Label className="text-xs text-muted-foreground">IMEI / Serial (opcional)</Label><Input name="imei" placeholder="000000000000000" className="mt-1 h-9" /></div>
            </div>
          </div>

          <Separator />

          {/* ── Serviço ── */}
          <div>
            <p className="text-xs font-medium mb-2">Serviço</p>
            <div>
              <Label className="text-xs text-muted-foreground">Defeito relatado</Label>
              <Textarea name="defeito" required placeholder="O que o cliente relatou?" rows={2} className="mt-1 resize-none" />
            </div>
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
              <Textarea name="observacoes" placeholder="Anotações adicionais..." rows={2} className="mt-1 resize-none" />
            </div>
          </div>

          <Separator />

          {/* ── Detalhes ── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Valor estimado</Label>
              <Input name="valor" type="number" step="0.01" min="0" placeholder="0,00" className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data entrada</Label>
              <Input name="data_entrada" type="date" defaultValue={today} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Previsão entrega</Label>
              <Input name="previsao" type="date" className="mt-1 h-9" />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Status inicial: <span className="font-medium text-foreground">Recebido</span></p>
          </div>

          {/* ── Submit ── */}
          <Button type="submit" className="w-full" disabled={createOrderMutation.isPending || !selectedClientId}>
            {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar Ordem de Serviço
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
