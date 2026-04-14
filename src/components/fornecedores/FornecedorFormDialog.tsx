import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CnpjLookup, type CnpjData } from "@/components/smart-inputs/CnpjLookup";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const emptyForm = {
  nome: "", responsavel: "", telefone: "", whatsapp: "", email: "",
  cnpj_cpf: "", endereco: "", categoria: "", prazo_medio: "",
  observacoes: "", ativo: true,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor?: any;
}

export function FornecedorFormDialog({ open, onOpenChange, fornecedor }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(emptyForm);
  const [cep, setCep] = useState("");

  useEffect(() => {
    if (fornecedor) {
      setForm({
        nome: fornecedor.nome || "",
        responsavel: fornecedor.responsavel || "",
        telefone: fornecedor.telefone || "",
        whatsapp: fornecedor.whatsapp || "",
        email: fornecedor.email || "",
        cnpj_cpf: fornecedor.cnpj_cpf || "",
        endereco: fornecedor.endereco || "",
        categoria: fornecedor.categoria || "",
        prazo_medio: fornecedor.prazo_medio || "",
        observacoes: fornecedor.observacoes || "",
        ativo: fornecedor.ativo ?? true,
      });
    } else {
      setForm(emptyForm);
    }
    setCep("");
  }, [fornecedor, open]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleCnpjData = useCallback((data: CnpjData) => {
    setForm((p: any) => ({
      ...p,
      nome: data.nome || p.nome,
      endereco: data.logradouro || p.endereco,
      email: data.email || p.email,
      telefone: data.telefone || p.telefone,
    }));
  }, []);

  const handleCepData = useCallback((data: CepData) => {
    setForm((p: any) => ({
      ...p,
      endereco: [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", "),
    }));
  }, []);

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    if (fornecedor?.id) {
      await supabase.from("fornecedores").update(form).eq("id", fornecedor.id);
    } else {
      await supabase.from("fornecedores").insert(form);
    }
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
    toast.success(fornecedor?.id ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fornecedor?.id ? "Editar" : "Novo"} Fornecedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CnpjLookup value={form.cnpj_cpf} onValueChange={(v) => set("cnpj_cpf", v)} onDataFound={handleCnpjData} />
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} /></div>
            <div><Label>Telefone</Label><MaskedInput mask="phone" value={form.telefone} onValueChange={(_, m) => set("telefone", m)} placeholder="(00) 00000-0000" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>WhatsApp</Label><MaskedInput mask="phone" value={form.whatsapp} onValueChange={(_, m) => set("whatsapp", m)} placeholder="(00) 00000-0000" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CepLookup cep={cep} onCepChange={setCep} onAddressFound={handleCepData} />
            <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex: Peças, Acessórios" /></div>
            <div><Label>Prazo médio</Label><Input value={form.prazo_medio} onChange={(e) => set("prazo_medio", e.target.value)} placeholder="Ex: 3-5 dias" /></div>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></div>
          <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativo</Label></div>
          <Button onClick={handleSave} className="w-full">{fornecedor?.id ? "Salvar" : "Cadastrar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
