import { useEffect, useState } from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [perfilId, setPerfilId] = useState<string>(fixedPerfilId || "none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fixedPerfilId) setPerfilId(fixedPerfilId);
  }, [fixedPerfilId]);

  const reset = () => {
    setNome("");
    setEmail("");
    setPerfilId(fixedPerfilId || "none");
  };

  const handleInviteUser = async () => {
    if (!email || !nome) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    if (!empresaId) {
      toast.error("Empresa não identificada para enviar o convite");
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("invite-user", {
        body: {
          email,
          nome,
          perfil_id: perfilId === "none" ? null : perfilId,
          empresa_id: empresaId,
        },
      });

      const errorMsg = res.error?.message || res.data?.error;
      if (errorMsg) {
        if (errorMsg.includes("already been registered")) {
          toast.success("Usuário reativado com sucesso!");
        } else {
          toast.error(errorMsg);
        }
      }
      if (!errorMsg || errorMsg.includes("already been registered")) {
        if (!errorMsg) toast.success(`Convite enviado para ${email}`);
        const perfilNome = perfisAcesso.find((p) => p.id === perfilId)?.nome_perfil || "Sem perfil";
        registrar("Usuário convidado", "configuracoes", null, null, { email, perfil: perfilNome });
        setOpen(false);
        reset();
        qc.invalidateQueries({ queryKey: ["user_profiles"] });
        await qc.refetchQueries({ queryKey: ["user_profiles"] });
      }
    } catch {
      toast.error("Erro ao enviar convite");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Mail className="h-3.5 w-3.5 mr-1" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome completo *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do colaborador" /></div>
          <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div>
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId} disabled={!!fixedPerfilId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {!fixedPerfilId && <SelectItem value="none">Sem perfil</SelectItem>}
                {perfisAcesso.filter((p) => p.ativo || p.id === fixedPerfilId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">O usuário receberá um email com link para definir sua senha e acessar o sistema.</p>
          <Button onClick={handleInviteUser} className="w-full" disabled={loading}>
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