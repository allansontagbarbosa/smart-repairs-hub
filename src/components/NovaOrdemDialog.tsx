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

import { toast } from "sonner";

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

  const createOrderMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const clienteId = selectedClientId;
      if (!clienteId) throw new Error("Selecione um cliente");

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

      const valorStr = fd.get("valor") as string;

      const { error: osErr } = await supabase.from("ordens_de_servico").insert({
        aparelho_id: aparelho.id,
        defeito_relatado: fd.get("defeito") as string,
        observacoes: (fd.get("observacoes") as string) || null,
        valor: valorStr ? parseFloat(valorStr) : null,
        data_entrada: new Date().toISOString(),
        tecnico: (fd.get("tecnico") as string) || null,
        status: "recebido" as Status,
      });
      if (osErr) throw osErr;

    },
    onSuccess: () => {
      setSelectedClientId("");
      onOpenChange(false);
      toast.success("Ordem de Serviço criada!");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao criar OS");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createOrderMutation.mutate(new FormData(e.currentTarget));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* ── 1. Cliente ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Cliente</p>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input name="novo_nome" required placeholder="Nome completo" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefone / WhatsApp</Label>
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
                    const container = (e.target as HTMLElement).closest(".rounded-lg")!;
                    const nome = (container.querySelector('[name="novo_nome"]') as HTMLInputElement)?.value;
                    const telefone = (container.querySelector('[name="novo_telefone"]') as HTMLInputElement)?.value;
                    if (nome && telefone) createClientMutation.mutate({ nome, telefone });
                  }}
                >
                  {createClientMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : null}
                  Cadastrar e selecionar
                </Button>
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

          {/* ── 2. Aparelho ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">2. Aparelho</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Marca *</Label>
                <Input name="marca" required placeholder="Apple, Samsung..." className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Modelo *</Label>
                <Input name="modelo" required placeholder="iPhone 15, S24..." className="mt-1 h-9" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <Input name="cor" placeholder="Preto" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Capacidade</Label>
                <Input name="capacidade" placeholder="128GB" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">IMEI (opcional)</Label>
                <Input name="imei" placeholder="000000000000000" className="mt-1 h-9" />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 3. Problema ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">3. Problema</p>
            <div>
              <Label className="text-xs text-muted-foreground">Defeito relatado *</Label>
              <Textarea
                name="defeito"
                required
                placeholder="Descreva o problema principal do aparelho..."
                rows={3}
                className="mt-1 resize-none text-sm"
              />
            </div>
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                name="observacoes"
                placeholder="Anotações adicionais, acessórios entregues..."
                rows={2}
                className="mt-1 resize-none text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* ── 4. Serviço ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">4. Serviço</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor estimado (R$)</Label>
                <Input name="valor" type="number" step="0.01" min="0" placeholder="0,00" className="mt-1 h-9" />
              </div>
              <div className="flex items-end">
                <div className="rounded-lg bg-muted/50 px-3 py-2 w-full text-center">
                  <p className="text-xs text-muted-foreground">Status inicial</p>
                  <p className="text-sm font-medium">Recebido</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 5. Controle Interno ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">5. Controle Interno</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Localização</Label>
                <Input name="localizacao" placeholder="Bancada, Técnico 1..." className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Técnico responsável</Label>
                <Input name="tecnico" placeholder="Nome do técnico" className="mt-1 h-9" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Data de entrada registrada automaticamente ao criar.
            </p>
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
