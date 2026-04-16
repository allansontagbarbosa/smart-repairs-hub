import { useState, useEffect } from "react";
import { Plus, Pencil, Search, Shield, History, Lock, Unlock, Mail, Loader2, UserPlus, ChevronDown, ChevronRight, Filter, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useAuditoria } from "@/hooks/useAuditoria";
import { format } from "date-fns";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Props {
  userProfiles: any[];
  perfisAcesso: any[];
  funcionarios: any[];
}

const MODULOS_CRUD = [
  { key: "assistencia", label: "Assistência" },
  { key: "financeiro", label: "Financeiro" },
  { key: "pecas", label: "Peças" },
  { key: "clientes", label: "Clientes" },
];

const MODULOS_BOOL = [
  { key: "dashboard", label: "Dashboard" },
  { key: "relatorios", label: "Relatórios" },
  { key: "configuracoes", label: "Configurações" },
  { key: "fila_ia", label: "Fila IA" },
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

export function ConfigUsuariosTab({ userProfiles, perfisAcesso, funcionarios }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = usePermissoes();
  const { registrar } = useAuditoria();
  const { empresaId } = useEmpresa();
  const [search, setSearch] = useState("");
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

  // Invite state
  const [openInvite, setOpenInvite] = useState(false);
  const [inviteNome, setInviteNome] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerfilId, setInvitePerfilId] = useState<string>("none");
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteNome) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    if (!empresaId) {
      toast.error("Empresa não identificada para enviar o convite");
      return;
    }

    setInviteLoading(true);
    try {
      const res = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail,
          nome: inviteNome,
          perfil_id: invitePerfilId === "none" ? null : invitePerfilId,
          empresa_id: empresaId,
        },
      });

      const errorMsg = res.error?.message || res.data?.error;
      if (errorMsg) {
        // "already been registered" is now handled server-side (reactivation)
        // but if it still comes through, treat as success
        if (errorMsg.includes("already been registered")) {
          toast.success("Usuário reativado com sucesso!");
        } else {
          toast.error(errorMsg);
        }
      }
      if (!errorMsg || errorMsg.includes("already been registered")) {
        if (!errorMsg) toast.success(`Convite enviado para ${inviteEmail}`);
        const perfilNome = perfisAcesso.find((p) => p.id === invitePerfilId)?.nome_perfil || "Sem perfil";
        registrar("Usuário convidado", "configuracoes", null, null, { email: inviteEmail, perfil: perfilNome });
        setOpenInvite(false);
        setInviteNome("");
        setInviteEmail("");
        setInvitePerfilId("none");
        qc.invalidateQueries({ queryKey: ["user_profiles"] });
        await qc.refetchQueries({ queryKey: ["user_profiles"] });
      }
    } catch {
      toast.error("Erro ao enviar convite");
    }
    setInviteLoading(false);
  };

  const filteredProfiles = userProfiles.filter((u) =>
    u.nome_exibicao?.toLowerCase().includes(search.toLowerCase())
  );

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

    if (perfilEditId && !perfilForm.ativo) {
      const currentPerfil = perfisAcesso.find((p) => p.id === perfilEditId);
      if (currentPerfil) {
        const otherConfigProfiles = perfisAcesso.filter(
          (p) => p.id !== perfilEditId && p.ativo && (p.permissoes as any)?.configuracoes === true
        );
        if ((currentPerfil.permissoes as any)?.configuracoes === true && otherConfigProfiles.length === 0) {
          toast.error("Não é possível desativar o último perfil com acesso a Configurações");
          return;
        }
      }
    }

    const payload = {
      nome_perfil: perfilForm.nome_perfil,
      descricao: perfilForm.descricao,
      ativo: perfilForm.ativo,
      permissoes: perfilForm.permissoes,
    };

    if (perfilEditId) {
      const oldPerfil = perfisAcesso.find((p) => p.id === perfilEditId);
      await supabase.from("perfis_acesso").update(payload).eq("id", perfilEditId);
      registrar("Perfil alterado", "configuracoes", perfilEditId, { permissoes: oldPerfil?.permissoes }, { permissoes: perfilForm.permissoes });
    } else {
      await supabase.from("perfis_acesso").insert(payload);
      registrar("Perfil criado", "configuracoes", null, null, { nome: perfilForm.nome_perfil });
    }
    qc.invalidateQueries({ queryKey: ["perfis_acesso"] });
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

  const handleUpdateUserProfile = async (profileId: string, updates: any) => {
    const profile = userProfiles.find((u) => u.id === profileId);
    await supabase.from("user_profiles").update(updates).eq("id", profileId);
    
    if ("ativo" in updates) {
      registrar(
        updates.ativo ? "Usuário ativado" : "Usuário desativado",
        "configuracoes",
        profileId,
        null,
        { nome: profile?.nome_exibicao }
      );
    }
    
    qc.invalidateQueries({ queryKey: ["user_profiles"] });
    toast.success("Usuário atualizado");
  };

  const handleDeleteUser = async (profileId: string) => {
    const profile = userProfiles.find((u) => u.id === profileId);

    const { data: { user } } = await supabase.auth.getUser();
    if (profile?.user_id === user?.id || profile?.id === user?.id) {
      toast.error("Você não pode excluir seu próprio usuário");
      return;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ ativo: false })
      .eq("id", profileId);

    if (error) {
      toast.error("Erro ao remover usuário: " + error.message);
      return;
    }

    registrar("Usuário removido", "configuracoes", profileId, null, {
      nome: profile?.nome_exibicao,
    });
    qc.invalidateQueries({ queryKey: ["user_profiles"] });
    await qc.refetchQueries({ queryKey: ["user_profiles"] });
    toast.success("Usuário removido do sistema");
    setConfirmDeleteId(null);
  };

  const totalAuditPages = Math.ceil(auditTotal / PAGE_SIZE);

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

      {/* Usuários */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Usuários do Sistema</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          {isAdmin && (
            <Dialog open={openInvite} onOpenChange={setOpenInvite}>
              <DialogTrigger asChild>
                <Button size="sm"><Mail className="h-3.5 w-3.5 mr-1" />Convidar usuário</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Convidar novo usuário</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nome completo *</Label><Input value={inviteNome} onChange={(e) => setInviteNome(e.target.value)} placeholder="Nome do colaborador" /></div>
                  <div><Label>Email *</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
                  <div>
                    <Label>Perfil de acesso</Label>
                    <Select value={invitePerfilId} onValueChange={setInvitePerfilId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem perfil</SelectItem>
                        {perfisAcesso.filter((p) => p.ativo).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">O usuário receberá um email com link para definir sua senha e acessar o sistema.</p>
                  <Button onClick={handleInviteUser} className="w-full" disabled={inviteLoading}>
                    {inviteLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                      <><UserPlus className="h-4 w-4 mr-2" /> Enviar convite</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Perfil</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Funcionário</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{u.nome_exibicao || "Sem nome"}</td>
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
                          value={u.perfil_id || "none"}
                          onValueChange={(v) => handleUpdateUserProfile(u.id, { perfil_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue placeholder="Perfil" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem perfil</SelectItem>
                            {perfisAcesso.filter((p) => p.ativo).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title={u.ativo ? "Desativar acesso" : "Ativar acesso"}
                          onClick={() => handleUpdateUserProfile(u.id, { ativo: !u.ativo })}
                        >
                         {u.ativo ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover usuário"
                          onClick={() => setConfirmDeleteId(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
            <DialogTitle>Remover usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja remover{" "}
            <strong>
              {userProfiles.find((u) => u.id === confirmDeleteId)?.nome_exibicao}
            </strong>{" "}
            do sistema? O usuário perderá acesso imediatamente mas seu
            histórico será preservado.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDeleteUser(confirmDeleteId)}
            >
              Remover acesso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
