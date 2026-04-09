import { useState } from "react";
import { Plus, Pencil, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  userProfiles: any[];
  perfisAcesso: any[];
  funcionarios: any[];
}

export function ConfigUsuariosTab({ userProfiles, perfisAcesso, funcionarios }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openPerfil, setOpenPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState<any>({ nome_perfil: "", descricao: "", ativo: true });
  const [perfilEditId, setPerfilEditId] = useState<string | null>(null);

  const filteredProfiles = userProfiles.filter((u) =>
    u.nome_exibicao?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSavePerfil = async () => {
    if (!perfilForm.nome_perfil) { toast.error("Nome é obrigatório"); return; }
    if (perfilEditId) {
      await supabase.from("perfis_acesso").update(perfilForm).eq("id", perfilEditId);
    } else {
      await supabase.from("perfis_acesso").insert(perfilForm);
    }
    qc.invalidateQueries({ queryKey: ["perfis_acesso"] });
    toast.success("Perfil salvo");
    setOpenPerfil(false);
    setPerfilForm({ nome_perfil: "", descricao: "", ativo: true });
    setPerfilEditId(null);
  };

  const handleEditPerfil = (p: any) => {
    setPerfilForm({ nome_perfil: p.nome_perfil, descricao: p.descricao || "", ativo: p.ativo });
    setPerfilEditId(p.id);
    setOpenPerfil(true);
  };

  const handleUpdateUserProfile = async (profileId: string, updates: any) => {
    await supabase.from("user_profiles").update(updates).eq("id", profileId);
    qc.invalidateQueries({ queryKey: ["user_profiles"] });
    toast.success("Usuário atualizado");
  };

  return (
    <div className="space-y-6">
      {/* Perfis de Acesso */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />Perfis de Acesso
          </CardTitle>
          <Dialog open={openPerfil} onOpenChange={(v) => { setOpenPerfil(v); if (!v) { setPerfilEditId(null); setPerfilForm({ nome_perfil: "", descricao: "", ativo: true }); } }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Perfil</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{perfilEditId ? "Editar" : "Novo"} Perfil</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={perfilForm.nome_perfil} onChange={(e) => setPerfilForm((p: any) => ({ ...p, nome_perfil: e.target.value }))} placeholder="Ex: Administrador" /></div>
                <div><Label>Descrição</Label><Input value={perfilForm.descricao} onChange={(e) => setPerfilForm((p: any) => ({ ...p, descricao: e.target.value }))} /></div>
                <div className="flex items-center gap-2"><Switch checked={perfilForm.ativo} onCheckedChange={(v) => setPerfilForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
                <Button onClick={handleSavePerfil} className="w-full">{perfilEditId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {perfisAcesso.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.nome_perfil}</span>
                  {p.descricao && <span className="text-xs text-muted-foreground">— {p.descricao}</span>}
                  {!p.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditPerfil(p)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {perfisAcesso.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum perfil cadastrado</div>}
          </div>
        </CardContent>
      </Card>

      {/* Usuários */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Usuários do Sistema</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
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
                      <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
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
                          variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => handleUpdateUserProfile(u.id, { ativo: !u.ativo })}
                        >
                          {u.ativo ? "Desativar" : "Ativar"}
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
    </div>
  );
}
