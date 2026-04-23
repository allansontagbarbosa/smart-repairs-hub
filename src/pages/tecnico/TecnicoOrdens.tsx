import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTecnicoIdentidade, useMinhasOS } from "@/hooks/useTecnico";
import { getStatusLabel } from "@/lib/status";
import { ChevronRight, Search } from "lucide-react";

const FILTROS = [
  { value: "abertas", label: "Abertas" },
  { value: "concluidas", label: "Concluídas" },
  { value: "todas", label: "Todas" },
];

export default function TecnicoOrdens() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: ordens = [], isLoading } = useMinhasOS(identidade?.funcionario_id);
  const [filtro, setFiltro] = useState("abertas");
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    return ordens.filter(o => {
      if (filtro === "abertas" && ["entregue", "cancelado"].includes(o.status)) return false;
      if (filtro === "concluidas" && !["pronto", "entregue"].includes(o.status)) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const blob = `${o.numero_formatado || o.numero} ${o.aparelhos?.marca} ${o.aparelhos?.modelo} ${o.clientes?.nome} ${o.defeito_relatado || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [ordens, filtro, busca]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Minhas Ordens</h1>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, aparelho, cliente..."
            className="pl-9"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <Tabs value={filtro} onValueChange={setFiltro}>
          <TabsList className="grid grid-cols-3 w-full">
            {FILTROS.map(f => (
              <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma OS encontrada.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map(os => (
            <Link key={os.id} to={`/tecnico/ordens/${os.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{os.numero_formatado || os.numero}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{getStatusLabel(os.status)}</Badge>
                      {os.prioridade === "alta" && <Badge variant="destructive" className="text-[10px]">Alta</Badge>}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {os.aparelhos?.marca} {os.aparelhos?.modelo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {os.clientes?.nome} · {os.defeito_relatado || "Sem defeito relatado"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
