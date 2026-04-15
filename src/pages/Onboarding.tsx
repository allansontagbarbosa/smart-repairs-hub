import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, ArrowRight } from "lucide-react";
import { MobileFixLogo } from "@/components/MobileFixLogo";
import { toast } from "sonner";

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingEmpresa, setCheckingEmpresa] = useState(true);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // Redirect if already has empresa
  useEffect(() => {
    if (authLoading || !user) return;

    supabase
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.empresa_id) {
          navigate("/", { replace: true });
        } else {
          setCheckingEmpresa(false);
          setEmail(user.email || "");
        }
      });
  }, [user, authLoading, navigate]);

  if (authLoading || !user || checkingEmpresa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEmpresa.trim()) return;

    setLoading(true);
    try {
      // STEP 1 — Create empresa
      const slug = nomeEmpresa
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { data: empresa, error: errEmpresa } = await supabase
        .from("empresas" as any)
        .insert({
          nome: nomeEmpresa.trim(),
          slug: slug + "-" + Date.now().toString(36),
          cnpj: cnpj.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || user.email,
          plano: "basico",
          owner_id: user.id,
        })
        .select()
        .single();

      if (errEmpresa) throw errEmpresa;
      const empresaId = (empresa as any).id;

      // STEP 2 — Create Administrador profile for the empresa
      const { data: perfil, error: errPerfil } = await supabase
        .from("perfis_acesso")
        .insert({
          empresa_id: empresaId,
          nome_perfil: "Administrador",
          descricao: "Acesso total ao sistema",
          permissoes: {
            dashboard: true,
            assistencia: { ver: true, criar: true, editar: true, excluir: true },
            financeiro: { ver: true, criar: true, editar: true, excluir: true },
            pecas: { ver: true, criar: true, editar: true, excluir: true },
            clientes: { ver: true, criar: true, editar: true, excluir: true },
            relatorios: true,
            configuracoes: true,
            fila_ia: true,
          },
        })
        .select()
        .single();

      if (errPerfil) throw errPerfil;

      // STEP 3 — Create funcionario (owner)
      const { data: func, error: errFunc } = await supabase
        .from("funcionarios")
        .insert({
          empresa_id: empresaId,
          nome: user.user_metadata?.full_name || user.email || "Administrador",
          email: user.email,
          cargo: "Administrador",
          funcao: "Administrador",
          ativo: true,
        })
        .select("id")
        .single();

      if (errFunc) throw errFunc;

      // STEP 4 — Link user_profile to empresa + perfil + funcionario
      const { error: errProfile } = await supabase
        .from("user_profiles")
        .update({
          empresa_id: empresaId,
          perfil_id: perfil.id,
          funcionario_id: func.id,
        })
        .eq("user_id", user.id);

      if (errProfile) throw errProfile;

      // STEP 5 — Create empresa_config
      const { error: errConfig } = await supabase
        .from("empresa_config")
        .insert({
          empresa_id: empresaId,
          nome: nomeEmpresa.trim(),
          gastos_fixos_mensais: 0,
        });

      if (errConfig) throw errConfig;

      // STEP 6 — Create default profiles
      await supabase.from("perfis_acesso").insert([
        {
          empresa_id: empresaId,
          nome_perfil: "Técnico",
          descricao: "Ordens de serviço e estoque",
          permissoes: {
            dashboard: true,
            assistencia: { ver: true, criar: true, editar: true, excluir: false },
            financeiro: { ver: false, criar: false, editar: false, excluir: false },
            pecas: { ver: true, criar: false, editar: false, excluir: false },
            clientes: { ver: true, criar: false, editar: false, excluir: false },
            relatorios: false,
            configuracoes: false,
            fila_ia: true,
          },
        },
        {
          empresa_id: empresaId,
          nome_perfil: "Financeiro",
          descricao: "Módulo financeiro e relatórios",
          permissoes: {
            dashboard: true,
            assistencia: { ver: true, criar: false, editar: false, excluir: false },
            financeiro: { ver: true, criar: true, editar: true, excluir: false },
            pecas: { ver: true, criar: true, editar: true, excluir: false },
            clientes: { ver: true, criar: false, editar: false, excluir: false },
            relatorios: true,
            configuracoes: false,
            fila_ia: false,
          },
        },
        {
          empresa_id: empresaId,
          nome_perfil: "Atendimento",
          descricao: "Cadastro de OS e clientes",
          permissoes: {
            dashboard: true,
            assistencia: { ver: true, criar: true, editar: true, excluir: false },
            financeiro: { ver: false, criar: false, editar: false, excluir: false },
            pecas: { ver: true, criar: false, editar: false, excluir: false },
            clientes: { ver: true, criar: true, editar: true, excluir: false },
            relatorios: false,
            configuracoes: false,
            fila_ia: false,
          },
        },
        {
          empresa_id: empresaId,
          nome_perfil: "Gerente",
          descricao: "Visão gerencial e aprovações",
          permissoes: {
            dashboard: true,
            assistencia: { ver: true, criar: false, editar: false, excluir: false },
            financeiro: { ver: true, criar: false, editar: false, excluir: false },
            pecas: { ver: true, criar: false, editar: false, excluir: false },
            clientes: { ver: true, criar: false, editar: false, excluir: false },
            relatorios: true,
            configuracoes: false,
            fila_ia: false,
          },
        },
      ]);

      toast.success("Empresa configurada com sucesso!");
      // Force page reload to refresh all contexts
      window.location.href = "/";
    } catch (err: any) {
      console.error("Erro no onboarding:", err);
      toast.error("Erro ao configurar empresa: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto">
            <MobileFixLogo size="md" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Building2 className="h-5 w-5" />
            Configure sua empresa
          </CardTitle>
          <CardDescription>
            Preencha os dados da sua empresa para começar a usar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-empresa">Nome da empresa *</Label>
              <Input
                id="nome-empresa"
                placeholder="Ex: Conserta Tudo Celulares"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(11) 99999-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-empresa">Email</Label>
                <Input
                  id="email-empresa"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !nomeEmpresa.trim()}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configurando...</>
              ) : (
                <>Começar a usar <ArrowRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
