import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import {
  Store, ExternalLink, Copy, Plus, KeyRound, ToggleLeft, ToggleRight, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Cfg = Record<string, any>;

export default function AtacadoCatalogoPublico() {
  const { empresaId } = useEmpresa();
  const qc = useQueryClient();
  const [form, setForm] = useState<Cfg>({});
  const [senhaOpen, setSenhaOpen] = useState<any>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["atacado-config-catalogo", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_configuracoes" as any)
        .select(
          "catalogo_publico_ativo, catalogo_publico_slug, catalogo_publico_titulo, catalogo_publico_descricao"
        )
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? {};
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const { data: acessos = [] } = useQuery({
    queryKey: ["atacado-catalogo-acessos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_catalogo_acessos")
        .select(`id, cliente_id, email_login, ativo, ultimo_login, created_at, cliente:atacado_clientes(razao_social, nome_fantasia)`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("atacado_configuracoes" as any)
        .upsert(
          { ...form, empresa_id: empresaId, updated_at: new Date().toISOString() },
          { onConflict: "empresa_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-config-catalogo"] });
      toast.success("Catálogo atualizado");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const urlPublica = form.catalogo_publico_slug
    ? `${window.location.origin}/catalogo/${form.catalogo_publico_slug}`
    : "";

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Store className="h-6 w-6" /> Catálogo Público B2B
        </h1>
        <p className="text-sm text-muted-foreground">
          URL pública para os lojistas logarem e pedirem sozinhos
        </p>
      </div>

      <Card className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">
            Catálogo público {form.catalogo_publico_ativo ? "ATIVO" : "DESATIVADO"}
          </p>
          <p className="text-sm text-muted-foreground">
            {form.catalogo_publico_ativo
              ? "Lojistas podem acessar e fazer pedidos pela URL pública"
              : "Catálogo não está acessível externamente"}
          </p>
        </div>
        <Switch
          checked={!!form.catalogo_publico_ativo}
          onCheckedChange={(v) => setForm({ ...form, catalogo_publico_ativo: v })}
        />
      </Card>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="acessos">Acessos ({acessos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card className="p-5 mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label>Slug do catálogo (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {window.location.origin}/catalogo/
                </span>
                <Input
                  value={form.catalogo_publico_slug ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      catalogo_publico_slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  placeholder="minha-empresa"
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>

            {urlPublica && (
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">URL pública</p>
                  <p className="text-sm font-mono truncate">{urlPublica}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(urlPublica);
                      toast.success("Copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" asChild>
                    <a href={urlPublica} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Título do catálogo</Label>
              <Input
                value={form.catalogo_publico_titulo ?? ""}
                onChange={(e) => setForm({ ...form, catalogo_publico_titulo: e.target.value })}
                placeholder="Ex: Atacado iPhone — Distribuidora Ditt"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (aparece na tela de login)</Label>
              <Textarea
                value={form.catalogo_publico_descricao ?? ""}
                onChange={(e) =>
                  setForm({ ...form, catalogo_publico_descricao: e.target.value })
                }
                placeholder="Bem-vindo! Acesse seu catálogo com e-mail e senha cedidos pelo nosso comercial."
                rows={3}
              />
            </div>

            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar configurações
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="acessos">
          <Card className="p-5 mt-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Acessos cadastrados</h3>
              <Button size="sm" onClick={() => setSenhaOpen({ novo: true })}>
                <Plus className="h-3 w-3 mr-1" /> Novo acesso
              </Button>
            </div>

            {acessos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhum lojista cadastrado para o catálogo
              </div>
            ) : (
              <div className="space-y-2">
                {acessos.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {a.cliente?.nome_fantasia || a.cliente?.razao_social || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.email_login} · Último login:{" "}
                        {a.ultimo_login
                          ? new Date(a.ultimo_login).toLocaleDateString("pt-BR")
                          : "nunca"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.ativo ? (
                        <ToggleRight className="h-4 w-4 text-success" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSenhaOpen({ acesso: a })}
                      >
                        <KeyRound className="h-3 w-3 mr-1" /> Resetar senha
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {senhaOpen && (
        <SetarSenhaDialog
          senhaOpen={senhaOpen}
          onClose={() => setSenhaOpen(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["atacado-catalogo-acessos"] });
            setSenhaOpen(null);
            toast.success("Acesso salvo");
          }}
          empresaId={empresaId!}
        />
      )}
    </div>
  );
}

function SetarSenhaDialog({ senhaOpen, onClose, onSaved, empresaId }: any) {
  const [clienteId, setClienteId] = useState(senhaOpen.acesso?.cliente_id ?? "");
  const [email, setEmail] = useState(senhaOpen.acesso?.email_login ?? "");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-disponiveis-catalogo", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_clientes")
        .select("id, razao_social, nome_fantasia")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .neq("status", "bloqueado");
      return data ?? [];
    },
    enabled: !!senhaOpen.novo,
  });

  const handleSalvar = async () => {
    if (!clienteId || !email || !senha) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (senha.length < 6) {
      toast.error("Senha precisa de pelo menos 6 caracteres");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("catalogo_setar_senha", {
        p_cliente_id: clienteId,
        p_email: email,
        p_senha: senha,
      });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{senhaOpen.novo ? "Novo acesso" : "Resetar senha"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {senhaOpen.novo && (
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia || c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>E-mail de login</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="lojista@empresa.com"
              disabled={!senhaOpen.novo}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
