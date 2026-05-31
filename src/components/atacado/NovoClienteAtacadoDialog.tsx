import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
}

const INITIAL = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  email: "",
  telefone: "",
  contato_principal: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  tabela_preco_id: "",
  limite_credito: "",
  prazo_pagamento_padrao: "30",
  condicao_pagamento_padrao: "30 dias",
  vendedor_responsavel_id: "",
  score: 3,
  observacoes: "",
};

export function NovoClienteAtacadoDialog({ open, onOpenChange, onSaved }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [form, setForm] = useState({ ...INITIAL });

  const { data: tabelas = [] } = useQuery({
    queryKey: ["atacado-tabelas", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_tabelas_preco" as any)
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativa", true)
        .is("deleted_at", null);
      return (data as any[]) ?? [];
    },
    enabled: open && !!empresaId,
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["funcionarios-vendedores", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("funcionarios" as any)
        .select("id, nome")
        .eq("empresa_id", empresaId!);
      return (data as any[]) ?? [];
    },
    enabled: open && !!empresaId,
  });

  const buscarCnpj = async () => {
    const cnpjLimpo = form.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Digite os 14 dígitos.", variant: "destructive" });
      return;
    }
    setBuscandoCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!r.ok) throw new Error("Não encontrado");
      const d = await r.json();
      setForm((f) => ({
        ...f,
        razao_social: d.razao_social || f.razao_social,
        nome_fantasia: d.nome_fantasia || f.nome_fantasia,
        email: d.email || f.email,
        telefone: d.ddd_telefone_1 || f.telefone,
        cep: d.cep ? String(d.cep).replace(/\D/g, "") : f.cep,
        endereco: d.logradouro || f.endereco,
        numero: d.numero || f.numero,
        complemento: d.complemento || f.complemento,
        bairro: d.bairro || f.bairro,
        cidade: d.municipio || f.cidade,
        uf: d.uf || f.uf,
      }));
      toast({ title: "✓ CNPJ encontrado", description: d.razao_social });
    } catch {
      toast({ title: "CNPJ não encontrado", description: "Preencha manualmente.", variant: "destructive" });
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const buscarCep = async () => {
    const cepLimpo = form.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setForm((f) => ({
        ...f,
        endereco: d.logradouro || f.endereco,
        bairro: d.bairro || f.bairro,
        cidade: d.localidade || f.cidade,
        uf: d.uf || f.uf,
      }));
    } catch {
      // silencioso
    }
  };

  const handleSalvar = async () => {
    if (!form.razao_social.trim()) {
      toast({ title: "Razão social obrigatória", variant: "destructive" });
      return;
    }
    if (form.cnpj && form.cnpj.replace(/\D/g, "").length !== 14) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
        inscricao_estadual: form.inscricao_estadual || null,
        inscricao_municipal: form.inscricao_municipal || null,
        email: form.email || null,
        telefone: form.telefone || null,
        contato_principal: form.contato_principal || null,
        cep: form.cep ? form.cep.replace(/\D/g, "") : null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        tabela_preco_id: form.tabela_preco_id || null,
        limite_credito: form.limite_credito
          ? parseFloat(form.limite_credito.replace(",", "."))
          : 0,
        prazo_pagamento_padrao: parseInt(form.prazo_pagamento_padrao) || 0,
        condicao_pagamento_padrao: form.condicao_pagamento_padrao || null,
        vendedor_responsavel_id: form.vendedor_responsavel_id || null,
        score: form.score,
        observacoes: form.observacoes || null,
        status: "ativo",
      };

      const { data, error } = await supabase
        .from("atacado_clientes" as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      toast({ title: "✓ Cliente cadastrado", description: form.razao_social });
      qc.invalidateQueries({ queryKey: ["atacado-clientes"] });

      setForm({ ...INITIAL });
      onOpenChange(false);
      if (onSaved && (data as any)?.id) onSaved((data as any).id);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Novo cliente B2B
          </DialogTitle>
          <DialogDescription>Lojista, revendedor ou parceiro de atacado</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* CNPJ */}
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscandoCnpj}>
                {buscandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razão social *</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição estadual</Label>
              <Input
                value={form.inscricao_estadual}
                onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição municipal</Label>
              <Input
                value={form.inscricao_municipal}
                onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })}
              />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contato principal</Label>
              <Input
                value={form.contato_principal}
                onChange={(e) => setForm({ ...form, contato_principal: e.target.value })}
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                onBlur={buscarCep}
              />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          {/* Comercial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tabela de preço</Label>
              <Select
                value={form.tabela_preco_id}
                onValueChange={(v) => setForm({ ...form, tabela_preco_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem tabela" />
                </SelectTrigger>
                <SelectContent>
                  {tabelas.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor responsável</Label>
              <Select
                value={form.vendedor_responsavel_id}
                onValueChange={(v) => setForm({ ...form, vendedor_responsavel_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limite de crédito (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.limite_credito}
                onChange={(e) => setForm({ ...form, limite_credito: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo pagamento (dias)</Label>
              <Input
                type="number"
                value={form.prazo_pagamento_padrao}
                onChange={(e) => setForm({ ...form, prazo_pagamento_padrao: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Condição padrão</Label>
              <Select
                value={form.condicao_pagamento_padrao}
                onValueChange={(v) => setForm({ ...form, condicao_pagamento_padrao: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="À vista (Pix/transferência)">À vista (Pix/transferência)</SelectItem>
                  <SelectItem value="30 dias">30 dias</SelectItem>
                  <SelectItem value="30/60 dias">30/60 dias</SelectItem>
                  <SelectItem value="30/60/90 dias">30/60/90 dias</SelectItem>
                  <SelectItem value="Boleto à vista">Boleto à vista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando
              </>
            ) : (
              "✓ Cadastrar cliente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
