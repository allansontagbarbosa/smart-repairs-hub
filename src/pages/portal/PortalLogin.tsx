import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Wrench, Search, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type SearchResult = {
  id: string;
  numero: number;
  status: string;
  aparelhos: { marca: string; modelo: string } | null;
  data_entrada: string;
};

export default function PortalLogin() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("os") || "");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchDone(false);

    const q = searchQuery.trim().replace(/^#/, "");

    // Try by OS number
    if (/^\d+$/.test(q)) {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, status, data_entrada, aparelhos(marca, modelo)")
        .eq("numero", parseInt(q))
        .is("deleted_at", null)
        .limit(5);

      if (data && data.length > 0) {
        setSearchResults(data as unknown as SearchResult[]);
        setSearchLoading(false);
        setSearchDone(true);
        return;
      }
    }

    // Try by telefone or CPF
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id")
      .is("deleted_at", null)
      .or(`telefone.ilike.%${q}%,cpf.ilike.%${q}%,whatsapp.ilike.%${q}%`)
      .limit(5);

    if (clientes && clientes.length > 0) {
      const clienteIds = clientes.map((c) => c.id);
      const { data: aparelhos } = await supabase
        .from("aparelhos")
        .select("id")
        .in("cliente_id", clienteIds);

      if (aparelhos && aparelhos.length > 0) {
        const aparelhoIds = aparelhos.map((a) => a.id);
        const { data: ordens } = await supabase
          .from("ordens_de_servico")
          .select("id, numero, status, data_entrada, aparelhos(marca, modelo)")
          .in("aparelho_id", aparelhoIds)
          .is("deleted_at", null)
          .order("data_entrada", { ascending: false })
          .limit(10);

        setSearchResults((ordens as unknown as SearchResult[]) || []);
        setSearchLoading(false);
        setSearchDone(true);
        return;
      }
    }

    setSearchResults([]);
    setSearchLoading(false);
    setSearchDone(true);
  };

  const statusLabels: Record<string, string> = {
    recebido: "Recebido",
    em_analise: "Em Análise",
    aguardando_aprovacao: "Aguard. Aprovação",
    aprovado: "Aprovado",
    em_reparo: "Em Reparo",
    aguardando_peca: "Aguard. Peça",
    pronto: "Pronto",
    entregue: "Entregue",
  };

  const statusColors: Record<string, string> = {
    recebido: "bg-muted text-muted-foreground",
    em_analise: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    aguardando_aprovacao: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    aprovado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    em_reparo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    aguardando_peca: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    pronto: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    entregue: "bg-muted text-muted-foreground",
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/portal",
    });

    if (result.error) {
      toast({ title: "Erro", description: String(result.error), variant: "destructive" });
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/portal");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">CellFix</p>
            <p className="text-[10px] text-muted-foreground">Portal do Cliente</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Acompanhe seu reparo</h1>
            <p className="text-sm text-muted-foreground">
              Digite o número da OS, CPF ou telefone para consultar
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nº da OS, CPF ou telefone..."
                className="pl-9 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : "Consultar"}
            </Button>
          </form>

          {/* Search results */}
          {searchDone && searchResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Nenhuma ordem encontrada.</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique os dados informados.</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {searchResults.length === 1 ? "Ordem encontrada:" : `${searchResults.length} ordens encontradas:`}
              </p>
              {searchResults.map((os) => (
                <button
                  key={os.id}
                  onClick={() => navigate(`/portal/ordem/${os.id}`)}
                  className="w-full rounded-xl border bg-card p-4 text-left hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">OS #{String(os.numero).padStart(3, "0")}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[os.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[os.status] || os.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {os.aparelhos?.marca} {os.aparelhos?.modelo} · {new Date(os.data_entrada).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Entrar com Google para ver histórico
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            O login com Google é opcional — serve para ver o histórico completo de seus aparelhos.
          </p>
        </div>
      </div>
    </div>
  );
}
