import { useState, useCallback } from "react";
import { Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CnpjLookup, type CnpjData } from "@/components/smart-inputs/CnpjLookup";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { CurrencySelect } from "@/components/smart-inputs/CurrencySelect";

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
    numero: empresa?.numero || "",
    complemento: empresa?.complemento || "",
    bairro: empresa?.bairro || "",
    cidade: empresa?.cidade || "",
    estado: empresa?.estado || "",
    cep: empresa?.cep || "",
    horario_funcionamento: empresa?.horario_funcionamento || "",
    cor_principal: empresa?.cor_principal || "#3b82f6",
    observacoes: empresa?.observacoes || "",
    moeda: empresa?.moeda || "BRL",
    formato_data: empresa?.formato_data || "DD/MM/YYYY",
  });

  const handleSave = () => saveEmpresa.mutate(form);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleCnpjData = useCallback((data: CnpjData) => {
    setForm((p) => ({
      ...p,
      nome: data.nome || p.nome,
      endereco: data.logradouro || p.endereco,
      cidade: data.municipio || p.cidade,
      estado: data.uf || p.estado,
      email: data.email || p.email,
      telefone: data.telefone || p.telefone,
    }));
  }, []);

  const handleCepData = useCallback((data: CepData) => {
    setForm((p) => ({
      ...p,
      endereco: data.logradouro || p.endereco,
      bairro: data.bairro || p.bairro,
      cidade: data.localidade || p.cidade,
      estado: data.uf || p.estado,
    }));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CnpjLookup value={form.cnpj_cpf} onValueChange={(v) => set("cnpj_cpf", v)} onDataFound={handleCnpjData} label="CNPJ / CPF" />
            <div><Label>Nome da empresa</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div><Label>Telefone</Label><MaskedInput mask="phone" value={form.telefone} onValueChange={(_, masked) => set("telefone", masked)} placeholder="(00) 00000-0000" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CepLookup cep={form.cep} onCepChange={(v) => set("cep", v)} onAddressFound={handleCepData} />
            <div className="md:col-span-2"><Label>Rua / Logradouro</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
            <div><Label>Número</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, Bloco, Sala..." /></div>
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => set("estado", e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Horário de funcionamento</Label><Input value={form.horario_funcionamento} onChange={(e) => set("horario_funcionamento", e.target.value)} placeholder="08:00 - 18:00" /></div>
            <div><Label>Cor principal</Label><Input type="color" value={form.cor_principal} onChange={(e) => set("cor_principal", e.target.value)} className="h-10" /></div>
            <CurrencySelect value={form.moeda} onValueChange={(v) => set("moeda", v)} />
          </div>

          <div><Label>Observações internas</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} /></div>
          <Button onClick={handleSave} disabled={saveEmpresa.isPending}><Save className="h-4 w-4 mr-1" />Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
