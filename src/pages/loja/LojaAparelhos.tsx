import { useState } from "react";
import { Plus, FileDown, Tag, Search, Smartphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskIMEI } from "@/lib/utils";
import { NovoAparelhoDialog } from "@/components/loja/NovoAparelhoDialog";

export default function LojaAparelhos() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<"novo" | "seminovo" | "vitrine" | "vendido">("novo");
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: aparelhos = [], isLoading } = useQuery({
    queryKey: ["loja-aparelhos", empresaId, tab, busca],
    queryFn: async () => {
      let query = (supabase as any)
        .from("loja_aparelhos")
        .select("*")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);

      if (tab === "novo") query = query.eq("condicao", "novo").eq("status", "estoque");
      if (tab === "seminovo") query = query.in("condicao", ["seminovo_a", "seminovo_b", "seminovo_c"]).eq("status", "estoque");
      if (tab === "vitrine") query = query.eq("status", "vitrine");
      if (tab === "vendido") query = query.eq("status", "vendido");

      if (busca) query = query.or(`modelo.ilike.%${busca}%,imei_1.ilike.%${busca}%,cor.ilike.%${busca}%`);

      const { data, error } = await query.order("data_entrada", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: counts } = useQuery({
    queryKey: ["loja-aparelhos-counts", empresaId],
    queryFn: async () => {
      const base = () => (supabase as any).from("loja_aparelhos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).is("deleted_at", null);
      const r = await Promise.all([
        base().eq("condicao", "novo").eq("status", "estoque"),
        base().in("condicao", ["seminovo_a", "seminovo_b", "seminovo_c"]).eq("status", "estoque"),
        base().eq("status", "vitrine"),
        base().eq("status", "vendido"),
      ]);
      return {
        novo: r[0].count ?? 0,
        seminovo: r[1].count ?? 0,
        vitrine: r[2].count ?? 0,
        vendido: r[3].count ?? 0,
      };
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && aparelhos.length === 0 && !busca;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Aparelhos no estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts ? `${counts.novo + counts.seminovo} aparelhos · ${counts.novo} novos · ${counts.seminovo} seminovos` : "carregando..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"><Tag className="h-4 w-4 mr-2" /> Gerar etiquetas</Button>
          <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-2" /> Importar XML</Button>
          <Button size="sm" onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-2" /> Entrada de aparelho</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="novo">Novos {counts && <Badge variant="secondary" className="ml-2">{counts.novo}</Badge>}</TabsTrigger>
          <TabsTrigger value="seminovo">Seminovos {counts && <Badge variant="secondary" className="ml-2">{counts.seminovo}</Badge>}</TabsTrigger>
          <TabsTrigger value="vitrine">Em vitrine {counts && <Badge variant="secondary" className="ml-2">{counts.vitrine}</Badge>}</TabsTrigger>
          <TabsTrigger value="vendido">Vendidos {counts && <Badge variant="secondary" className="ml-2">{counts.vendido}</Badge>}</TabsTrigger>
        </TabsList>
      </Tabs>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Smartphone className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum aparelho cadastrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Comece cadastrando um aparelho novo ou importando uma NF-e (XML).
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button><Plus className="h-4 w-4 mr-2" /> Cadastrar aparelho</Button>
            <Button variant="outline"><FileDown className="h-4 w-4 mr-2" /> Importar XML NF-e</Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar modelo, IMEI ou cor..." className="pl-10" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Aparelho</th>
                  <th className="text-left p-3">IMEI</th>
                  <th className="text-right p-3">Custo</th>
                  <th className="text-right p-3">Preço</th>
                  <th className="text-right p-3">Margem</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Dias</th>
                </tr>
              </thead>
              <tbody>
                {aparelhos.map((ap: any) => {
                  const custo = Number(ap.custo ?? 0);
                  const preco = Number(ap.preco_venda ?? 0);
                  const margem = custo > 0 ? ((preco - custo) / custo) * 100 : 0;
                  const dias = ap.data_entrada ? Math.floor((Date.now() - new Date(ap.data_entrada).getTime()) / 86400000) : 0;
                  return (
                    <tr key={ap.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="text-xl">📱</div>
                          <div>
                            <p className="font-semibold">{ap.modelo} · {ap.capacidade}</p>
                            <p className="text-xs text-muted-foreground capitalize">{ap.cor} · {ap.condicao}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{maskIMEI(ap.imei_1 ?? "")}</td>
                      <td className="p-3 text-right tabular-nums">{formatBRL(custo)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatBRL(preco)}</td>
                      <td className="p-3 text-right">
                        <Badge variant={margem >= 15 ? "default" : "secondary"} className="tabular-nums">
                          {margem.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 capitalize">{ap.status}</td>
                      <td className={`p-3 text-right tabular-nums ${dias > 60 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{dias}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
