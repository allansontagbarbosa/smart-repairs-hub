import { useState, useCallback } from "react";
import { Building2, Save, MapPin, Phone, Palette, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CnpjLookup, type CnpjData } from "@/components/smart-inputs/CnpjLookup";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { CurrencySelect } from "@/components/smart-inputs/CurrencySelect";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  empresa: any;
  saveEmpresa: any;
}

export function ConfigGeralTab({ empresa, saveEmpresa }: Props) {
  const { theme, setTheme, fontSize, setFontSize, density, setDensity } = useTheme();
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
    <div className="space-y-5">
      {/* Card 1: Identificação */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Identificação
          </CardTitle>
          <CardDescription className="text-xs">Dados principais da empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CnpjLookup value={form.cnpj_cpf} onValueChange={(v) => set("cnpj_cpf", v)} onDataFound={handleCnpjData} label="CNPJ / CPF" />
            <div><Label>Razão Social / Nome</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome da empresa" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Contato */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Contato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Telefone</Label><MaskedInput mask="phone" value={form.telefone} onValueChange={(_, masked) => set("telefone", masked)} placeholder="(00) 00000-0000" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@empresa.com" /></div>
            <div><Label>Horário de funcionamento</Label><Input value={form.horario_funcionamento} onChange={(e) => set("horario_funcionamento", e.target.value)} placeholder="08:00 - 18:00" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Endereço */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <CepLookup cep={form.cep} onCepChange={(v) => set("cep", v)} onAddressFound={handleCepData} />
            <div className="sm:col-span-2"><Label>Rua / Logradouro</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
            <div><Label>Número</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, Bloco, Sala..." /></div>
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => set("estado", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Preferências */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Cor principal</Label>
              <div className="flex gap-2 items-center">
                <Input type="color" value={form.cor_principal} onChange={(e) => set("cor_principal", e.target.value)} className="h-10 w-14 p-1 cursor-pointer" />
                <Input value={form.cor_principal} onChange={(e) => set("cor_principal", e.target.value)} className="flex-1 font-mono text-xs" />
              </div>
            </div>
            <CurrencySelect value={form.moeda} onValueChange={(v) => set("moeda", v)} />
            <div><Label>Formato de data</Label><Input value={form.formato_data} onChange={(e) => set("formato_data", e.target.value)} placeholder="DD/MM/YYYY" /></div>
          </div>
          <div><Label>Observações internas</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} placeholder="Anotações internas sobre a empresa..." /></div>
        </CardContent>
      </Card>

      {/* Card 5: Aparência */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Aparência
          </CardTitle>
          <CardDescription className="text-xs">Preferências visuais da interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Tema</Label>
            <RadioGroup value={theme} onValueChange={(v) => setTheme(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="light" id="t-light" /><Label htmlFor="t-light" className="font-normal">Claro</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="dark" id="t-dark" /><Label htmlFor="t-dark" className="font-normal">Escuro</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="system" id="t-system" /><Label htmlFor="t-system" className="font-normal">Sistema (automático)</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-2 block">Tamanho da fonte</Label>
            <RadioGroup value={fontSize} onValueChange={(v) => setFontSize(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="sm" id="f-sm" /><Label htmlFor="f-sm" className="font-normal">Pequeno</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="md" id="f-md" /><Label htmlFor="f-md" className="font-normal">Médio</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="lg" id="f-lg" /><Label htmlFor="f-lg" className="font-normal">Grande</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-2 block">Densidade da interface</Label>
            <RadioGroup value={density} onValueChange={(v) => setDensity(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="comfortable" id="d-comf" /><Label htmlFor="d-comf" className="font-normal">Confortável</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="compact" id="d-comp" /><Label htmlFor="d-comp" className="font-normal">Compacto</Label></div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex justify-end">
        <Button onClick={handleSave} disabled={saveEmpresa.isPending} size="sm">
          <Save className="h-4 w-4 mr-1.5" />
          {saveEmpresa.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
