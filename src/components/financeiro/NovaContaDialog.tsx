import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CreatableSelect } from "@/components/smart-inputs/CreatableSelect";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContaPagar } from "@/hooks/useFinanceiro";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConta: ContaPagar | null;
  categorias: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  lojas: { id: string; nome: string }[];
  ordens: { id: string; numero: number; valor: number | null }[];
}

type FormValues = {
  descricao: string;
  categoria: string;
  centro_custo: string;
  fornecedor_id: string;
  loja_id: string;
  ordem_servico_id: string;
  valor: string;
  data_vencimento: string;
  recorrente: boolean;
  observacoes: string;
};

export function NovaContaDialog({ open, onOpenChange, editingConta, categorias, centros, fornecedores, lojas, ordens }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingConta;

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      descricao: "",
      categoria: "Outros",
      centro_custo: "",
      fornecedor_id: "",
      loja_id: "",
      ordem_servico_id: "",
      valor: "",
      data_vencimento: new Date().toISOString().split("T")[0],
      recorrente: false,
      observacoes: "",
    },
  });

  useEffect(() => {
    if (open && editingConta) {
      reset({
        descricao: editingConta.descricao,
        categoria: editingConta.categoria,
        centro_custo: editingConta.centro_custo ?? "",
        fornecedor_id: editingConta.fornecedor_id ?? "",
        loja_id: editingConta.loja_id ?? "",
        ordem_servico_id: editingConta.ordem_servico_id ?? "",
        valor: editingConta.valor ? String(editingConta.valor) : "",
        data_vencimento: editingConta.data_vencimento,
        recorrente: editingConta.recorrente,
        observacoes: editingConta.observacoes ?? "",
      });
    } else if (open) {
      reset({
        descricao: "",
        categoria: "Outros",
        centro_custo: "",
        fornecedor_id: "",
        loja_id: "",
        ordem_servico_id: "",
        valor: "",
        data_vencimento: new Date().toISOString().split("T")[0],
        recorrente: false,
        observacoes: "",
      });
    }
  }, [open, editingConta, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const clean = (v: string) => v && v !== "__nenhum__" ? v : null;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("empresa_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .single();
      const empresa_id = profile?.empresa_id ?? null;

      const payload = {
        descricao: values.descricao,
        categoria: values.categoria,
        centro_custo: clean(values.centro_custo),
        fornecedor_id: clean(values.fornecedor_id),
        loja_id: clean(values.loja_id),
        ordem_servico_id: clean(values.ordem_servico_id),
        valor: parseFloat(values.valor),
        data_vencimento: values.data_vencimento,
        recorrente: values.recorrente,
        observacoes: values.observacoes || null,
        fornecedor: null,
        empresa_id,
      };

      if (isEditing) {
        const { error } = await supabase.from("contas_a_pagar").update(payload).eq("id", editingConta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_a_pagar").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success(isEditing ? "Conta atualizada!" : "Conta criada!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreateFornecedor = async (nome: string): Promise<string | null> => {
    const { data, error } = await supabase.from("fornecedores").insert({ nome }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["fornecedores_fin"] });
    return data.id;
  };

  const recorrente = watch("recorrente");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input {...register("descricao", { required: true })} placeholder="Ex: Aluguel da loja" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={watch("categoria")} onValueChange={v => setValue("categoria", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Centro de Custo</Label>
              <Select value={watch("centro_custo") || "__nenhum__"} onValueChange={v => setValue("centro_custo", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Nenhum</SelectItem>
                  {centros.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <CurrencyInput
                value={watch("valor") ? parseFloat(watch("valor")) : null}
                onValueChange={v => setValue("valor", String(v))}
                placeholder="Digite o valor"
              />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" {...register("data_vencimento", { required: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <CreatableSelect
                label="Fornecedor"
                value={watch("fornecedor_id") || ""}
                onValueChange={v => setValue("fornecedor_id", v)}
                options={fornecedores}
                onCreateNew={handleCreateFornecedor}
                placeholder="Selecionar fornecedor"
                entityName="fornecedor"
              />
            </div>
            <div>
              <Label>Loja</Label>
              <Select value={watch("loja_id") || "__nenhum__"} onValueChange={v => setValue("loja_id", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar loja" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Nenhuma</SelectItem>
                  {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Ordem de Serviço</Label>
            <Select value={watch("ordem_servico_id") || "__nenhum__"} onValueChange={v => setValue("ordem_servico_id", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Vincular a uma OS" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">Nenhuma</SelectItem>
                {ordens.slice(0, 50).map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    OS #{o.numero} {o.valor ? `- R$ ${Number(o.valor).toFixed(2)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={recorrente} onCheckedChange={v => setValue("recorrente", v)} />
            <Label className="mb-0">Conta fixa/recorrente mensal</Label>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea {...register("observacoes")} rows={2} placeholder="Observações opcionais" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
