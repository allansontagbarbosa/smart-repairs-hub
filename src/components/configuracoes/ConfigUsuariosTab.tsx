import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Search, Shield, History, Lock, Unlock, Mail, KeyRound, Loader2, ChevronDown, ChevronRight, Filter, Trash2, CheckCircle2, XCircle, AlertTriangle, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissoes, invalidatePermissoesCache } from "@/hooks/usePermissoes";
import { useAuditoria } from "@/hooks/useAuditoria";
import { format } from "date-fns";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { InviteUserDialog } from "./InviteUserDialog";

interface Props {
  userProfiles: any[];
  perfisAcesso: any[];
  funcionarios: any[];
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const MODULOS_CRUD = [
  { key: "assistencia", label: "Assistência" },
  { key: "financeiro", label: "Financeiro" },
  { key: "pecas", label: "Peças" },
  { key: "clientes", label: "Clientes" },
  { key: "aparelhos", label: "Aparelhos" },
  { key: "compras", label: "Compras" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "faturas_b2b", label: "Faturas B2B" },
  { key: "metas", label: "Metas" },
  { key: "rh", label: "RH" },
];

const MODULOS_BOOL = [
  { key: "dashboard", label: "Dashboard" },
  { key: "relatorios", label: "Relatórios" },
  { key: "configuracoes", label: "Configurações" },
  { key: "fila_ia", label: "Fila IA" },
  { key: "desempenho_tecnicos", label: "Desempenho técnicos" },
  { key: "paineis_tv", label: "Painéis TV" },
];

const ACOES = ["ver", "criar", "editar", "excluir"] as const;

const MODULO_BADGE_COLORS: Record<string, string> = {
  assistencia: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  financeiro: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  configuracoes: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  pecas: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function buildDefaultPermissoes() {
  const p: any = {};
  for (const m of MODULOS_CRUD) p[m.key] = { ver: false, criar: false, editar: false, excluir: false };
  for (const m of MODULOS_BOOL) p[m.key] = false;
  return p;
}

const PAGE_SIZE = 20;

interface CrudCellEditorProps {
  moduloLabel: string;
  value: { ver: boolean; criar: boolean; editar: boolean; excluir: boolean };
  disabled?: boolean;
  onChange: (acao: "ver" | "criar" | "editar" | "excluir", novoValor: boolean) => void;
}

function CrudCellEditor({ moduloLabel, value, disabled, onChange }: CrudCellEditorProps) {
  const summary =
    (value.ver ? "V" : "-") +
    (value.criar ? "C" : "-") +
    (value.editar ? "E" : "-") +
    (value.excluir ? "D" : "-");

  const allOn = summary === "VCED";
  const allOff = summary === "----";

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      className={cn(
        "font-mono text-xs h-7 px-2",
        allOff && "text-muted-foreground",
        allOn && "text-green-600 dark:text-green-400",
        !allOff && !allOn && "text-foreground"
      )}
    >
      {summary}
    </Button>
  );

  if (disabled) return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="center">
        <p className="text-xs font-semibold uppercase mb-2">{moduloLabel}</p>
        <div className="space-y-2">
          {(["ver", "criar", "editar", "excluir"] as const).map((acao) => (
            <label key={acao} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={!!value[acao]}
                onCheckedChange={(c) => onChange(acao, !!c)}
              />
              <span className="capitalize">{acao}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ConfigUsuariosTab({ userProfiles, perfisAcesso, funcionarios, loading, error, onRetry }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = usePermissoes();
  const { registrar } = useAuditoria();
  const { empresaId } = useEmpresa();
  const [search, setSearch] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "inativos">("todos");
  const [openPerfil, setOpenPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState<any>({ nome_perfil: "", descricao: "", ativo: true, permissoes: buildDefaultPermissoes() });
  const [perfilEditId, setPerfilEditId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditModuloFilter, setAuditModuloFilter] = useState("todos");
  const [auditSearch, setAuditSearch] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const normalizar = (s: string) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredProfiles = useMemo(() => {
    const q = normalizar(search);
    return userProfiles.filter((u) => {
      const nome = normalizar(u.nome_exibicao);
      const email = normalizar((u as any).funcionarios?.email ?? "");
      const perfilNome = normalizar((u as any).perfis_acesso?.nome_perfil ?? "");
      const matchSearch = !q || nome.includes(q) || email.includes(q) || perfilNome.includes(q);
      const matchPerfil = filtroPerfil === "todos" || u.perfil_id === filtroPerfil;
      const matchStatus =
        filtroStatus === "todos" ||
        (filtroStatus === "ativos" && u.ativo) ||
        (filtroStatus === "inativos" && !u.ativo);
      return matchSearch && matchPerfil && matchStatus;
    });
  }, [userProfiles, search, filtroPerfil, filtroStatus]);

  const kpis = useMemo(() => ({
    ativos: userProfiles.filter((u) => u.ativo).length,
    inativos: userProfiles.filter((u) => !u.ativo).length,
    sem_perfil: userProfiles.filter((u) => !u.perfil_id && u.ativo).length,
  }), [userProfiles]);

  // Fetch audit logs with pagination and filters
  useEffect(() => {
    if (isAdmin && showAudit) {
      const fetchLogs = async () => {
        let q: any = supabase
          .from("auditoria")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(auditPage * PAGE_SIZE, (auditPage + 1) * PAGE_SIZE - 1);

        if (auditModuloFilter !== "todos") {
          q = q.eq("modulo", auditModuloFilter);
        }
        if (auditSearch.trim()) {
          q = q.or(`user_nome.ilike.%${auditSearch}%,acao.ilike.%${auditSearch}%`);
        }

        const { data, count } = await q;
        setAuditLogs(data || []);
        setAuditTotal(count || 0);
      };
      fetchLogs();
    }
  }, [isAdmin, showAudit, auditPage, auditModuloFilter, auditSearch]);

  const handleSavePerfil = async () => {
    if (!perfilForm.nome_perfil) { toast.error("Nome é obrigatório"); return; }

    const { data, error } = await supabase.rpc("salvar_perfil_acesso", {
      p_perfil_id: perfilEditId,
      p_nome_perfil: perfilForm.nome_perfil,
      p_descricao: perfilForm.descricao || null,
      p_permissoes: perfilForm.permissoes,
      p_ativo: perfilForm.ativo,
    });

    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Erro ao salvar perfil");
      return;
    }

    if (perfilEditId) {
      const oldPerfil = perfisAcesso.find((p) => p.id === perfilEditId);
      registrar("Perfil alterado", "configuracoes", perfilEditId, { permissoes: oldPerfil?.permissoes }, { permissoes: perfilForm.permissoes });
    } else {
      registrar("Perfil criado", "configuracoes", null, null, { nome: perfilForm.nome_perfil });
    }
    qc.invalidateQueries({ queryKey: ["perfis_acesso"] });
    invalidatePermissoesCache();
    toast.success("Perfil salvo");
    setOpenPerfil(false);
    resetForm();
  };

  const resetForm = () => {
    setPerfilForm({ nome_perfil: "", descricao: "", ativo: true, permissoes: buildDefaultPermissoes() });
    setPerfilEditId(null);
  };

  const handleEditPerfil = (p: any) => {
    setPerfilForm({
      nome_perfil: p.nome_perfil,
      descricao: p.descricao || "",
      ativo: p.ativo,
      permissoes: p.permissoes || buildDefaultPermissoes(),
    });
    setPerfilEditId(p.id);
    setOpenPerfil(true);
  };

  const toggleCrudPerm = (modulo: string, acao: string) => {
    setPerfilForm((prev: any) => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [modulo]: {
          ...prev.permissoes[modulo],
          [acao]: !prev.permissoes[modulo]?.[acao],
        },
      },
    }));
  };

  const toggleBoolPerm = (modulo: string) => {
    setPerfilForm((prev: any) => ({
      ...prev,
      permissoes: { ...prev.permissoes, [modulo]: !prev.permissoes[modulo] },
    }));
  };

  const handleUpdateUserProfile = async (profileId: string, updates: { ativo?: boolean; perfil_id?: string | null }) => {
    const profile = userProfiles.find((u) => u.id === profileId);

    const { data, error } = await supabase.rpc("atualizar_user_profile", {
      p_user_profile_id: profileId,
      p_perfil_id: (updates.perfil_id ?? null) as any,
      p_ativo: updates.ativo ?? null,
    });

    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Erro ao atualizar usuário");
      return;
    }

    if ("ativo" in updates) {
      registrar(updates.ativo ? "Usuário ativado" : "Usuário desativado", "configuracoes", profileId, null, { nome: profile?.nome_exibicao });
    }
    if ("perfil_id" in updates) {
      registrar("Perfil alterado", "configuracoes", profileId, null, { nome: profile?.nome_exibicao });
    }

    qc.invalidateQueries({ queryKey: ["user_profiles"] });
    invalidatePermissoesCache();
    toast.success("Usuário atualizado");
  };

  const tentarDesativar = (profile: any) => {
    const perfilNome = normalizar(profile.perfis_acesso?.nome_perfil ?? "");
    if (perfilNome.startsWith("admin")) {
      if (!confirm(`Desativar o ADMINISTRADOR "${profile.nome_exibicao}"? Esta ação reduz drasticamente o acesso da empresa. Confirma?`)) {
        return;
      }
    }
    handleUpdateUserProfile(profile.id, { ativo: false });
  };

  const confirmarRevogar = async () => {
    if (!confirmDeleteId) return;
    const profile = userProfiles.find((u) => u.id === confirmDeleteId);

    const { data, error } = await supabase.rpc("revogar_usuario", {
      p_user_profile_id: confirmDeleteId,
    });

    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Erro ao revogar");
      return;
    }

    const r = data as any;
    registrar("Usuário revogado", "configuracoes", confirmDeleteId, null, { nome: profile?.nome_exibicao });
    qc.invalidateQueries({ queryKey: ["user_profiles"] });
    await qc.refetchQueries({ queryKey: ["user_profiles"] });
    invalidatePermissoesCache();
    toast.success(
      `Acesso de ${r.nome} revogado.` +
      (r.sessoes_revogadas ? " Sessão ativa encerrada." : "") +
      " (Cadastro preservado para reativação)"
    );
    setConfirmDeleteId(null);
  };

  const handleResendInvite = async (profile: any) => {
    const email = profile.funcionarios?.email;
    if (!email) {
      toast.error("Email não encontrado para este usuário");
      return;
    }
    if (!empresaId) return;

    setResendingId(profile.id);
    try {
      const res = await supabase.functions.invoke("invite-user", {
        body: {
          email,
          nome: profile.nome_exibicao || profile.funcionarios?.nome || "",
          perfil_id: profile.perfil_id || null,
          empresa_id: empresaId,
        },
      });
      const errorMsg = res.error?.message || res.data?.error;
      if (errorMsg && !errorMsg.includes("already been registered")) {
        toast.error("Erro ao reenviar: " + errorMsg);
      } else {
        toast.success(`Convite reenviado para ${email}`);
        registrar("Convite reenviado", "configuracoes", profile.id, null, {
          nome: profile.nome_exibicao,
          email,
        });
      }
    } catch {
      toast.error("Erro ao reenviar convite");
    }
    setResendingId(null);
  };

  const handleResetPassword = async (profile: any) => {
    const email = profile.email || profile.funcionarios?.email;
    if (!email) {
      toast.error("Email não encontrado para este usuário");
      return;
    }
    setResendingId(profile.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        toast.error("Erro ao enviar reset: " + error.message);
      } else {
        toast.success(`Email de redefinição enviado para ${email}`);
        registrar("Reset de senha enviado", "configuracoes", profile.id, null, {
          nome: profile.nome_exibicao,
          email,
        });
      }
    } catch {
      toast.error("Erro ao enviar reset de senha");
    }
    setResendingId(null);
  };


  const totalAuditPages = Math.ceil(auditTotal / PAGE_SIZE);

  const isAdminPerfil = (perfil: any) => /^admin/i.test(perfil?.nome_perfil || "");

  const savePerfilPermissoes = async (perfil: any, novasPermissoes: any) => {
    const oldPermissoes = perfil.permissoes;

    // Optimistic update via React Query cache
    qc.setQueryData<any[]>(["perfis_acesso"], (prev) =>
      (prev || []).map((p) => (p.id === perfil.id ? { ...p, permissoes: novasPermissoes } : p))
    );

    const { data, error } = await supabase.rpc("salvar_perfil_acesso", {
      p_perfil_id: perfil.id,
      p_nome_perfil: perfil.nome_perfil,
      p_descricao: perfil.descricao || null,
      p_permissoes: novasPermissoes,
      p_ativo: perfil.ativo,
    });

    if (error || !(data as any)?.success) {
      // rollback
      qc.setQueryData<any[]>(["perfis_acesso"], (prev) =>
        (prev || []).map((p) => (p.id === perfil.id ? { ...p, permissoes: oldPermissoes } : p))
      );
      toast.error((data as any)?.error || error?.message || "Erro ao salvar permissão");
      return false;
    }

    registrar("Perfil alterado", "configuracoes", perfil.id, { permissoes: oldPermissoes }, { permissoes: novasPermissoes });
    invalidatePermissoesCache();
    qc.invalidateQueries({ queryKey: ["perfis_acesso"] });
    return true;
  };

  const handleToggleBoolPermissao = async (perfil: any, modulo: string, novoValor: boolean) => {
    const novasPermissoes = { ...((perfil.permissoes as any) || {}), [modulo]: novoValor };
    const ok = await savePerfilPermissoes(perfil, novasPermissoes);
    if (ok) toast.success(`${perfil.nome_perfil}: ${modulo.replace(/_/g, " ")} ${novoValor ? "habilitado" : "desabilitado"}`);
  };

  const handleToggleCrudPermissao = async (perfil: any, modulo: string, acao: string, novoValor: boolean) => {
    const atual = ((perfil.permissoes as any) || {})[modulo] || { ver: false, criar: false, editar: false, excluir: false };
    const novasPermissoes = {
      ...((perfil.permissoes as any) || {}),
      [modulo]: { ...atual, [acao]: novoValor },
    };
    const ok = await savePerfilPermissoes(perfil, novasPermissoes);
    if (ok) toast.success(`${perfil.nome_perfil}: ${modulo} → ${acao} ${novoValor ? "✓" : "✗"}`);
  };


  return (
    <div className="space-y-6">
      {/* Perfis de Acesso */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />Perfis de Acesso
          </CardTitle>
          <Dialog open={openPerfil} onOpenChange={(v) => { setOpenPerfil(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Perfil</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{perfilEditId ? "Editar" : "Novo"} Perfil</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={perfilForm.nome_perfil} onChange={(e) => setPerfilForm((p: any) => ({ ...p, nome_perfil: e.target.value }))} placeholder="Ex: Administrador" /></div>
                <div><Label>Descrição</Label><Input value={perfilForm.descricao} onChange={(e) => setPerfilForm((p: any) => ({ ...p, descricao: e.target.value }))} /></div>
                <div className="flex items-center gap-2"><Switch checked={perfilForm.ativo} onCheckedChange={(v) => setPerfilForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>

                <Separator />
                <Label className="text-sm font-semibold">Permissões por módulo</Label>

                <div className="grid grid-cols-2 gap-2">
                  {MODULOS_BOOL.map((m) => (
                    <div key={m.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={!!perfilForm.permissoes?.[m.key]}
                        onCheckedChange={() => toggleBoolPerm(m.key)}
                      />
                      <span className="text-sm">{m.label}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  {MODULOS_CRUD.map((m) => (
                    <div key={m.key}>
                      <span className="text-sm font-medium">{m.label}</span>
                      <div className="flex gap-4 mt-1">
                        {ACOES.map((a) => (
                          <div key={a} className="flex items-center gap-1.5">
                            <Checkbox
                              checked={!!perfilForm.permissoes?.[m.key]?.[a]}
                              onCheckedChange={() => toggleCrudPerm(m.key, a)}
                            />
                            <span className="text-xs capitalize">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSavePerfil} className="w-full">{perfilEditId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {perfisAcesso.map((p) => {
              const userCount = userProfiles.filter((u) => u.perfil_id === p.id).length;
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.nome_perfil}</span>
                    {p.descricao && <span className="text-xs text-muted-foreground">— {p.descricao}</span>}
                    <Badge variant="outline" className="text-[10px]">{userCount} {userCount === 1 ? "usuário" : "usuários"}</Badge>
                    {!p.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditPerfil(p)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {perfisAcesso.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum perfil cadastrado</div>}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />Ativos</p>
            <p className="text-2xl font-semibold mt-1">{kpis.ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-muted-foreground" />Inativos</p>
            <p className="text-2xl font-semibold mt-1">{kpis.inativos}</p>
          </CardContent>
        </Card>
        <Card className={kpis.sem_perfil > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Sem perfil</p>
            <p className={`text-2xl font-semibold mt-1 ${kpis.sem_perfil > 0 ? "text-amber-600" : ""}`}>{kpis.sem_perfil}</p>
          </CardContent>
        </Card>
      </div>

      {/* Usuários */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Usuários do Sistema</CardTitle>
          {isAdmin && <InviteUserDialog perfisAcesso={perfisAcesso} />}
        </CardHeader>
        <CardContent className="p-0">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email, perfil..."
                className="pl-9 h-9"
              />
            </div>
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="h-9 w-44 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {perfisAcesso.filter((p) => p.ativo).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
              <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Perfil</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Funcionário</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando usuários...
                  </td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={6} className="p-6 text-center">
                    <p className="text-sm text-destructive mb-2">Não foi possível carregar a lista.</p>
                    <p className="text-xs text-muted-foreground mb-3">{error.message}</p>
                    {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
                  </td></tr>
                )}
                {!loading && !error && filteredProfiles.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{u.nome_exibicao || "Sem nome"}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {(u as any).funcionarios?.email || "—"}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {(u as any).perfis_acesso?.nome_perfil || "—"}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {(u as any).funcionarios?.nome || "—"}
                    </td>
                    <td className="p-3">
                      {u.ativo ? (
                        <Badge variant="default">🟢 Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">🔴 Inativo</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Select
                          value={u.perfil_id || ""}
                          onValueChange={(v) => handleUpdateUserProfile(u.id, { perfil_id: v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue placeholder="Perfil" />
                          </SelectTrigger>
                          <SelectContent>
                            {perfisAcesso.filter((p) => p.ativo).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(() => {
                          const ehAtivo = u.ativo && !!u.user_id && !!u.funcionario_id;
                          if (ehAtivo) {
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                                title="Enviar email de redefinição de senha"
                                disabled={resendingId === u.id}
                                onClick={() => handleResetPassword(u)}
                              >
                                {resendingId === u.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <KeyRound className="h-3.5 w-3.5" />
                                }
                              </Button>
                            );
                          }
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                              title="Reenviar convite"
                              disabled={resendingId === u.id}
                              onClick={() => handleResendInvite(u)}
                            >
                              {resendingId === u.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Mail className="h-3.5 w-3.5" />
                              }
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title={u.ativo ? "Desativar acesso" : "Ativar acesso"}
                          onClick={() => u.ativo ? tentarDesativar(u) : handleUpdateUserProfile(u.id, { ativo: true })}
                        >
                         {u.ativo ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Revogar acesso"
                          onClick={() => setConfirmDeleteId(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !error && filteredProfiles.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    {search ? "Nenhum usuário encontrado para a busca." : "Nenhum usuário ainda. Convide o primeiro pelo botão acima."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Matriz de permissões — editável inline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />Matriz de permissões
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Clique nos checkboxes para alternar. Em módulos CRUD, clique no resumo (ex: <span className="font-mono">VCED</span>) para editar Ver/Criar/Editar/Excluir. Perfis Administrador são travados.
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Módulo</th>
                {perfisAcesso.filter((p) => p.ativo).map((p) => (
                  <th key={p.id} className="text-center p-2 font-medium">{p.nome_perfil}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULOS_BOOL.map((m) => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="p-2">{m.label}</td>
                  {perfisAcesso.filter((p) => p.ativo).map((p) => {
                    const value = !!(p.permissoes as any)?.[m.key];
                    const adminLocked = isAdminPerfil(p);
                    return (
                      <td key={p.id} className="p-2 text-center">
                        <Checkbox
                          checked={adminLocked ? true : value}
                          disabled={adminLocked}
                          onCheckedChange={(c) => handleToggleBoolPermissao(p, m.key, !!c)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {MODULOS_CRUD.map((m) => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="p-2">{m.label}</td>
                  {perfisAcesso.filter((p) => p.ativo).map((p) => {
                    const adminLocked = isAdminPerfil(p);
                    const raw = (p.permissoes as any)?.[m.key];
                    const value = adminLocked
                      ? { ver: true, criar: true, editar: true, excluir: true }
                      : raw || { ver: false, criar: false, editar: false, excluir: false };
                    return (
                      <td key={p.id} className="p-2 text-center">
                        <CrudCellEditor
                          moduloLabel={m.label}
                          value={value}
                          disabled={adminLocked}
                          onChange={(acao, val) => handleToggleCrudPermissao(p, m.key, acao, val)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>


      {/* Audit Log — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />Log de Auditoria
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAudit(!showAudit)}>
              {showAudit ? "Ocultar" : "Exibir"}
            </Button>
          </CardHeader>
          {showAudit && (
            <CardContent className="p-0">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 px-4 py-3 border-b">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por usuário ou ação..."
                    value={auditSearch}
                    onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(0); }}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                <Select value={auditModuloFilter} onValueChange={(v) => { setAuditModuloFilter(v); setAuditPage(0); }}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os módulos</SelectItem>
                    <SelectItem value="assistencia">Assistência</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="configuracoes">Configurações</SelectItem>
                    <SelectItem value="pecas">Peças</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-8 p-2"></th>
                      <th className="text-left p-2 font-medium">Data</th>
                      <th className="text-left p-2 font-medium">Usuário</th>
                      <th className="text-left p-2 font-medium">Ação</th>
                      <th className="text-left p-2 font-medium">Módulo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      const modulo = (log as any).modulo || log.tabela || "";
                      const badgeClass = MODULO_BADGE_COLORS[modulo] || "bg-muted text-muted-foreground";
                      const isExpanded = expandedLogId === log.id;
                      const hasDetails = log.dados_anteriores || log.dados_novos;

                      return (
                        <>
                          <tr
                            key={log.id}
                            className={`border-b last:border-0 ${hasDetails ? "cursor-pointer hover:bg-muted/30" : ""}`}
                            onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <td className="p-2 text-center">
                              {hasDetails && (
                                isExpanded
                                  ? <ChevronDown className="h-3 w-3 text-muted-foreground inline" />
                                  : <ChevronRight className="h-3 w-3 text-muted-foreground inline" />
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground whitespace-nowrap">
                              {log.created_at ? format(new Date(log.created_at), "dd/MM 'às' HH:mm") : "—"}
                            </td>
                            <td className="p-2">{log.user_nome || "Sistema"}</td>
                            <td className="p-2">{log.acao}</td>
                            <td className="p-2">
                              {modulo && (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                                  {modulo}
                                </span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && hasDetails && (
                            <tr key={`${log.id}-detail`} className="bg-muted/20">
                              <td colSpan={5} className="p-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  {log.dados_anteriores && (
                                    <div>
                                      <span className="font-semibold text-muted-foreground block mb-1">Dados anteriores</span>
                                      <pre className="bg-muted/50 rounded p-2 overflow-x-auto text-[10px] max-h-40 overflow-y-auto">
                                        {JSON.stringify(log.dados_anteriores, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.dados_novos && (
                                    <div>
                                      <span className="font-semibold text-muted-foreground block mb-1">Dados novos</span>
                                      <pre className="bg-muted/50 rounded p-2 overflow-x-auto text-[10px] max-h-40 overflow-y-auto">
                                        {JSON.stringify(log.dados_novos, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum registro</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalAuditPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
                  <span>{auditTotal} registros — Página {auditPage + 1} de {totalAuditPages}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={auditPage >= totalAuditPages - 1} onClick={() => setAuditPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar acesso?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            O usuário{" "}
            <strong>
              {userProfiles.find((u) => u.id === confirmDeleteId)?.nome_exibicao}
            </strong>{" "}
            não conseguirá mais entrar no sistema. A sessão ativa será encerrada
            imediatamente. O cadastro fica preservado para reativação futura.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRevogar}>
              Revogar acesso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

