import { useState } from "react";
import { Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  empresa: any;
  saveEmpresa: any;
}

export function ConfigGeralTab({ empresa, saveEmpresa }: Props) {
  const [form, setForm] = useState({
    nome: empresa?.nome || "",
    cnpj_cpf: empresa?.cnpj_cpf || "",
    telefone: empresa?.telefone || "",
    email: empresa?.email || "",
    endereco: empresa?.endereco || "",
    cidade: empresa?.cidade || "",
    estado: empresa?.estado || "",
    horario_funcionamento: empresa?.horario_funcionamento || "",
    cor_principal: empresa?.cor_principal || "#3b82f6",
    observacoes: empresa?.observacoes || "",
    moeda: empresa?.moeda || "BRL",
    formato_data: empresa?.formato_data || "DD/MM/YYYY",
  });

  const handleSave = () => saveEmpresa.mutate(form);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome da empresa</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div><Label>CNPJ / CPF</Label><Input value={form.cnpj_cpf} onChange={(e) => set("cnpj_cpf", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => set("estado", e.target.value)} /></div>
            <div><Label>Horário de funcionamento</Label><Input value={form.horario_funcionamento} onChange={(e) => set("horario_funcionamento", e.target.value)} placeholder="08:00 - 18:00" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Cor principal</Label><Input type="color" value={form.cor_principal} onChange={(e) => set("cor_principal", e.target.value)} className="h-10" /></div>
            <div><Label>Moeda</Label><Input value={form.moeda} onChange={(e) => set("moeda", e.target.value)} /></div>
            <div><Label>Formato de data</Label><Input value={form.formato_data} onChange={(e) => set("formato_data", e.target.value)} /></div>
          </div>
          <div><Label>Observações internas</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} /></div>
          <Button onClick={handleSave} disabled={saveEmpresa.isPending}><Save className="h-4 w-4 mr-1" />Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
