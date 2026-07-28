import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, UserPlus, ChevronDown, ChevronRight, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuditoria } from "@/hooks/useAuditoria";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface InviteUserDialogProps {
  perfisAcesso: any[];
  fixedPerfilId?: string | null;
  triggerLabel?: string;
  title?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const PERFIS_CLT = ["tecnico", "atendimento", "gerente", "financeiro", "vendedor"];

export function InviteUserDialog({
  perfisAcesso,
  fixedPerfilId,
  triggerLabel = "Convidar usuário",
  title = "Convidar novo usuário",
}: InviteUserDialogProps) {
  const qc = useQueryClient();
  const { registrar } = useAuditoria();
  const { empresaId } = useEmpresa();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfilId, setPerfilId] = useState<string>(fixedPerfilId || "");
  const [loading, setLoading] = useState(false);
  const [expandirRH, setExpandirRH] = useState(false);
  const [linkAcesso, setLinkAcesso] = useState<string | null>(null);
  const [dadosRH, setDadosRH] = useState({
    cpf: "",
    telefone: "",
    cargo: "",
    tipo_vinculo: "clt",
    salario: "",
    data_admissao: "",
    carga_horaria_semanal: 44,
  });

  useEffect(() => {
    if (fixedPerfilId) setPerfilId(fixedPerfilId);
  }, [fixedPerfilId]);

  const perfilNome = useMemo(
    () => perfisAcesso.find((p) => p.id === perfilId)?.nome_perfil ?? "",
    [perfilId, perfisAcesso],
  );
  const mostrarBlocoRH = PERFIS_CLT.includes(norm(perfilNome));

  const reset = () => {
    setNome("");
    setEmail("");
    setPerfilId(fixedPerfilId || "");
    setExpandirRH(false);
    setLinkAcesso(null);
    setDadosRH({ cpf: "", telefone: "", cargo: "", tipo_vinculo: "clt", salario: "", data_admissao: "", carga_horaria_semanal: 44 });
  };

  const handleInviteUser = async () => {
    if (!email || !nome) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      toast.error("Email inválido. Use formato nome@dominio.com");
      return;
    }
    if (!perfilId) {
      toast.error("Selecione um perfil de acesso");
      return;
    }

    if (!empresaId) {
      toast.error("Empresa não identificada para enviar o convite");
      return;
    }

    setLoading(true);
    try {
      const dados_rh = (expandirRH && mostrarBlocoRH) ? {
        cpf: dadosRH.cpf || null,
        telefone: dadosRH.telefone || null,
        cargo: dadosRH.cargo || null,
        tipo_vinculo: dadosRH.tipo_vinculo,
        salario_centavos: dadosRH.salario ? Math.round(parseFloat(dadosRH.salario) * 100) : null,
        data_admissao: dadosRH.data_admissao || null,
        carga_horaria_semanal: dadosRH.carga_horaria_semanal || null,
      } : null;

      const res = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim(),
          nome,
          perfil_id: perfilId,
          empresa_id: empresaId,
          dados_rh,
        },
      });

      const errorMsg = res.error?.message || res.data?.error;
      if (errorMsg) {
        if (errorMsg.includes("already been registered")) {
          toast.success("Usuário reativado com sucesso!");
        } else {
          throw new Error(errorMsg);
        }
      }
      if (!errorMsg || errorMsg.includes("already been registered")) {
        if (!errorMsg) toast.success(`Convite enviado para ${email}`);
        const perfilNomeReg = perfisAcesso.find((p) => p.id === perfilId)?.nome_perfil || "Sem perfil";
        registrar("Usuário convidado", "configuracoes", null, null, { email, perfil: perfilNomeReg });
        const link = (res.data as any)?.action_link as string | undefined;
        if (link) {
          setLinkAcesso(link);
        } else {
          setOpen(false);
          reset();
        }
        qc.invalidateQueries({ queryKey: ["user_profiles"] });
        qc.invalidateQueries({ queryKey: ["rh"] });
        await qc.refetchQueries({ queryKey: ["user_profiles"] });
      }
    } catch (err) {
      toast.error(`Erro ao enviar convite: ${(err as Error)?.message || "desconhecido"}`);
    }
    setLoading(false);
  };

  const canSubmit = !loading && !!email && !!nome && !!perfilId;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Mail className="h-3.5 w-3.5 mr-1" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome completo *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do colaborador" /></div>
          <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div>
            <Label>Perfil de acesso *</Label>
            <Select value={perfilId} onValueChange={setPerfilId} disabled={!!fixedPerfilId}>
              <SelectTrigger><SelectValue placeholder="Selecione um perfil *" /></SelectTrigger>
              <SelectContent>
                {perfisAcesso.filter((p) => p.ativo || p.id === fixedPerfilId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mostrarBlocoRH && (
            <Collapsible open={expandirRH} onOpenChange={setExpandirRH}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors p-3 flex items-center gap-3 text-left"
                >
                  <div className="h-9 w-9 rounded-md bg-primary/15 text-primary grid place-items-center shrink-0">
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {expandirRH ? "Ocultar dados de RH" : "Cadastrar dados de RH agora"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expandirRH
                        ? "Os campos serão enviados junto com o convite."
                        : "Opcional · CPF, salário e contrato · pra já entrar na folha"}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandirRH ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3 border-l-2 border-primary/20 pl-3">
                <p className="text-xs text-muted-foreground">
                  Esses dados deixam o cadastro no RH completo. Você pode preencher depois também.
                </p>
                <div><Label className="text-xs">CPF</Label><Input value={dadosRH.cpf} onChange={(e) => setDadosRH({ ...dadosRH, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
                <div><Label className="text-xs">Telefone</Label><Input value={dadosRH.telefone} onChange={(e) => setDadosRH({ ...dadosRH, telefone: e.target.value })} placeholder="(11) 99999-9999" /></div>
                <div><Label className="text-xs">Cargo</Label><Input value={dadosRH.cargo} onChange={(e) => setDadosRH({ ...dadosRH, cargo: e.target.value })} placeholder="Ex: Técnico de celular" /></div>
                <div>
                  <Label className="text-xs">Tipo de vínculo</Label>
                  <Select value={dadosRH.tipo_vinculo} onValueChange={(v) => setDadosRH({ ...dadosRH, tipo_vinculo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="estagio">Estágio</SelectItem>
                      <SelectItem value="autonomo">Autônomo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Salário (R$)</Label><Input type="number" step="0.01" value={dadosRH.salario} onChange={(e) => setDadosRH({ ...dadosRH, salario: e.target.value })} placeholder="0,00" /></div>
                <div><Label className="text-xs">Data de admissão</Label><Input type="date" value={dadosRH.data_admissao} onChange={(e) => setDadosRH({ ...dadosRH, data_admissao: e.target.value })} /></div>
                <div><Label className="text-xs">Carga horária semanal</Label><Input type="number" value={dadosRH.carga_horaria_semanal} onChange={(e) => setDadosRH({ ...dadosRH, carga_horaria_semanal: Number(e.target.value) })} /></div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <p className="text-xs text-muted-foreground">O usuário receberá um email com link para definir sua senha e acessar o sistema.</p>
          <Button onClick={handleInviteUser} className="w-full" disabled={!canSubmit}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> Enviar convite</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
