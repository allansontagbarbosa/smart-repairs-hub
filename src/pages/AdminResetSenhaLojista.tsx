import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, KeyRound, Search } from "lucide-react";

interface Lojista {
  user_id: string;
  nome: string;
  email: string;
  status_acesso: string | null;
  convite_aceito_em: string | null;
}

export default function AdminResetSenhaLojista() {
  const [busca, setBusca] = useState("");
  const [lojistas, setLojistas] = useState<Lojista[]>([]);
  const [selecionado, setSelecionado] = useState<Lojista | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("lojista_grupos")
        .select("user_id, nome, email, status_acesso, convite_aceito_em")
        .not("user_id", "is", null)
        .order("nome", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Erro ao carregar lojistas: " + error.message);
      } else {
        setLojistas((data as Lojista[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lojistas.slice(0, 50);
    return lojistas.filter(
      (l) =>
        l.nome?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [busca, lojistas]);

  const handleReset = async () => {
    if (!selecionado) return;
    setResetando(true);
    setSenhaGerada(null);
    const { data, error } = await supabase.rpc("admin_resetar_senha_lojista", {
      p_email_lojista: selecionado.email,
    });
    setResetando(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    const result = data as { sucesso?: boolean; senha_temporaria?: string };
    if (result?.sucesso && result.senha_temporaria) {
      setSenhaGerada(result.senha_temporaria);
      toast.success("Senha temporária gerada");
    } else {
      toast.error("Resposta inesperada");
    }
  };

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado");
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resetar senha de lojista</h1>
        <p className="text-sm text-muted-foreground">
          Gera uma senha temporária para um lojista que perdeu acesso ao portal.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setSelecionado(null);
              setSenhaGerada(null);
            }}
            className="pl-9"
          />
        </div>

        <div className="border rounded-md divide-y max-h-80 overflow-auto">
          {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
          {!loading && filtrados.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhum lojista encontrado.</div>
          )}
          {filtrados.map((l) => (
            <button
              key={l.user_id}
              onClick={() => { setSelecionado(l); setSenhaGerada(null); }}
              className={`w-full text-left p-3 hover:bg-muted/50 transition ${
                selecionado?.user_id === l.user_id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.email}</div>
                </div>
                <Badge variant={l.status_acesso === "ativo" ? "default" : "secondary"}>
                  {l.status_acesso ?? "—"}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {selecionado && (
        <Card className="p-4 space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Lojista selecionado</div>
            <div className="font-medium">{selecionado.nome}</div>
            <div className="text-sm">{selecionado.email}</div>
          </div>

          <Button onClick={handleReset} disabled={resetando} className="gap-2">
            <KeyRound className="h-4 w-4" />
            {resetando ? "Gerando..." : "Gerar senha temporária"}
          </Button>

          {senhaGerada && (
            <div className="border rounded-md p-3 bg-muted/40 space-y-2">
              <div className="text-xs text-muted-foreground">Senha temporária (passe pro lojista):</div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-semibold bg-background px-3 py-1 rounded border">
                  {senhaGerada}
                </code>
                <Button size="sm" variant="outline" onClick={() => copiar(senhaGerada)} className="gap-1">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Peça pro lojista entrar com essa senha e trocar no primeiro acesso.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
