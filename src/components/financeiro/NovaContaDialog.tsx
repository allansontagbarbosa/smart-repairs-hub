import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { ContaPagar } from "@/hooks/useFinanceiro";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConta: ContaPagar | null;
  categorias: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
}

type FormValues = {
  descricao: string;
  categoria: string;
  centro_custo: string;
  fornecedor: string;
  valor: string;
  data_vencimento: string;
  recorrente: boolean;
  observacoes: string;
};

export function NovaContaDialog({ open, onOpenChange, editingConta, categorias, centros }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingConta;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      descricao: "",
      categoria: "Outros",
      centro_custo: "",
      fornecedor: "",
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
        fornecedor: editingConta.fornecedor ?? "",
        valor: String(editingConta.valor),
        data_vencimento: editingConta.data_vencimento,
        recorrente: editingConta.recorrente,
        observacoes: editingConta.observacoes ?? "",
      });
    } else if (open) {
      reset({
        descricao: "",
        categoria: "Outros",
        centro_custo: "",
        fornecedor: "",
        valor: "",
        data_vencimento: new Date().toISOString().split("T")[0],
        recorrente: false,
        observacoes: "",
      });
    }
  }, [open, editingConta, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        descricao: values.descricao,
        categoria: values.categoria,
        centro_custo: values.centro_custo || null,
        fornecedor: values.fornecedor || null,
        valor: parseFloat(values.valor),
        data_vencimento: values.data_vencimento,
        recorrente: values.recorrente,
        observacoes: values.observacoes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("contas_a_pagar").update(payload).eq("id", editingConta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_a_pagar").insert(payload);
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

  const recorrente = watch("recorrente");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              <Select value={watch("centro_custo")} onValueChange={v => setValue("centro_custo", v)}>
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
              <Input type="number" step="0.01" {...register("valor", { required: true, min: 0.01 })} placeholder="0,00" />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" {...register("data_vencimento", { required: true })} />
            </div>
          </div>

          <div>
            <Label>Fornecedor</Label>
            <Input {...register("fornecedor")} placeholder="Nome do fornecedor" />
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
