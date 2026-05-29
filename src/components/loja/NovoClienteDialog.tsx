import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, User, MapPin } from "lucide-react";
import { isValidCPF, formatCPFInput, formatCEPInput, formatTelInput, sugerirLimite, formatBRL } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
}

type Tag = "novo" | "regular" | "vip" | "problema" | "blacklist";

const INITIAL = {
  nome: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  instagram: "",
  renda_mensal: "",
  limite_credito: 0,
  tag: "novo" as Tag,
  observacoes: "",
};

export function NovoClienteDialog({ open, onOpenChange, onSaved }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [form, setForm] = useState(INITIAL);

  const rendaNum = parseFloat(form.renda_mensal.replace(",", ".")) || 0;
  const limiteSugerido = sugerirLimite(rendaNum);

  useEffect(() => {
    if (rendaNum > 0) {
      setForm((f) => ({ ...f, limite_credito: sugerirLimite(rendaNum) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.renda_mensal]);

  const reset = () => setForm(INITIAL);

  const handleCepChange = async (raw: string) => {
    const formatted = formatCEPInput(raw);
    setForm((f) => ({ ...f, cep: formatted }));
    const numbers = raw.replace(/\D/g, "");
    if (numbers.length === 8) {
      setBuscandoCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast({ title: "CEP não encontrado", description: "Verifique o CEP digitado.", variant: "destructive" });
        } else {
          setForm((f) => ({
            ...f,
            endereco: data.logradouro || f.endereco,
            bairro: data.bairro || f.bairro,
            cidade: data.localidade || f.cidade,
            uf: data.uf || f.uf,
          }));
          setTimeout(() => document.getElementById("cli-numero")?.focus(), 100);
        }
      } catch {
        toast({ title: "Erro ao buscar CEP", description: "Verifique sua conexão.", variant: "destructive" });
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleSalvar = async () => {
    if (!form.nome || form.nome.trim().length < 3) {
      toast({ title: "Nome obrigatório", description: "Informe nome completo do cliente.", variant: "destructive" });
      return;
    }
    if (form.cpf && !isValidCPF(form.cpf)) {
      toast({ title: "CPF inválido", description: "Verifique os dígitos do CPF.", variant: "destructive" });
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await (supabase as any)
        .from("loja_clientes")
        .insert({
          empresa_id: empresaId,
          nome: form.nome.trim(),
          cpf: form.cpf ? form.cpf.replace(/\D/g, "") : null,
          rg: form.rg || null,
          data_nascimento: form.data_nascimento || null,
          telefone: form.telefone ? form.telefone.replace(/\D/g, "") : null,
          email: form.email || null,
          cep: form.cep ? form.cep.replace(/\D/g, "") : null,
          endereco: form.endereco || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          instagram: form.instagram || null,
          renda_mensal: rendaNum || null,
          limite_credito: form.limite_credito || 0,
          score_interno: 3,
          tag: form.tag,
          observacoes: form.observacoes || null,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          toast({ title: "CPF já cadastrado", description: "Esse CPF já existe na sua base de clientes Loja.", variant: "destructive" });
          return;
        }
        throw error;
      }

      toast({ title: "✓ Cliente cadastrado", description: `${form.nome.split(" ")[0]} adicionado à base de clientes Loja.` });

      qc.invalidateQueries({ queryKey: ["loja-clientes"] });
      qc.invalidateQueries({ queryKey: ["loja-clientes-counts"] });

      reset();
      onOpenChange(false);
      if (onSaved && data?.id) onSaved(data.id);
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Novo cliente Loja
          </DialogTitle>
          <DialogDescription>
            Base separada da Assistência. Cliente cadastrado aqui só aparece na Loja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Dados pessoais */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados pessoais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="João da Silva" />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPFInput(e.target.value) })} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </div>
              <div>
                <Label>Data nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatTelInput(e.target.value) })} placeholder="(11) 98765-4321" />
              </div>
              <div className="sm:col-span-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" />
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Endereço
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="col-span-2 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  CEP {buscandoCep && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <Label>Logradouro</Label>
                <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua das Flores" />
              </div>
              <div className="col-span-1 sm:col-span-1">
                <Label>Número</Label>
                <Input id="cli-numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="123" />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Label>Complemento</Label>
                <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="apto 42" />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div className="col-span-1 sm:col-span-4">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Label>UF</Label>
                <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
              </div>
            </div>
          </section>

          {/* Crediário */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Crediário (opcional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Renda mensal declarada</Label>
                <Input inputMode="decimal" value={form.renda_mensal} onChange={(e) => setForm({ ...form, renda_mensal: e.target.value })} placeholder="3500,00" />
              </div>
              <div>
                <Label>Limite de crédito</Label>
                <Input
                  type="number"
                  value={form.limite_credito || ""}
                  onChange={(e) => setForm({ ...form, limite_credito: parseInt(e.target.value) || 0 })}
                  placeholder={limiteSugerido > 0 ? formatBRL(limiteSugerido) : "0"}
                />
                {rendaNum > 0 && form.limite_credito !== limiteSugerido && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, limite_credito: limiteSugerido })}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Usar sugerido: {formatBRL(limiteSugerido)}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Tag + extras */}
          <section className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tag inicial</Label>
                <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v as Tag })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo (default)</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="vip">★ VIP</SelectItem>
                    <SelectItem value="problema">⚠ Problema</SelectItem>
                    <SelectItem value="blacklist">✕ Blacklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@joaodasilva" />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Cliente do amigo do irmão, sempre paga em dia."
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              "✓ Salvar cliente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
