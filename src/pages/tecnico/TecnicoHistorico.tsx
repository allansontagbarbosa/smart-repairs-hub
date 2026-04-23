import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight, History, Search } from "lucide-react";
import { useTecnicoIdentidade, useMinhasOS } from "@/hooks/useTecnico";
import { statusLabels } from "@/lib/status";

export default function TecnicoHistorico() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: ordens = [], isLoading } = useMinhasOS(identidade?.funcionario_id);
  const [q, setQ] = useState("");

  const concluidas = useMemo(
    () =>
      ordens
        .filter((o) => ["entregue", "cancelado", "pronto"].includes(o.status))
        .filter((o) => {
          const t = q.trim().toLowerCase();
          if (!t) return true;
          return (
            (o.numero_formatado || String(o.numero)).toLowerCase().includes(t) ||
            o.aparelhos?.marca?.toLowerCase().includes(t) ||
            o.aparelhos?.modelo?.toLowerCase().includes(t) ||
            o.clientes?.nome?.toLowerCase().includes(t)
          );
        }),
    [ordens, q]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground">Ordens já concluídas, entregues ou canceladas.</p>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por OS, aparelho, cliente..." className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : concluidas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum atendimento finalizado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {concluidas.map((os) => (
            <Link key={os.id} to={`/tecnico/ordens/${os.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{os.numero_formatado || os.numero}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {statusLabels[os.status as keyof typeof statusLabels] ?? os.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {os.aparelhos?.marca} {os.aparelhos?.modelo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {os.clientes?.nome}
                      {os.data_conclusao
                        ? ` · ${new Date(os.data_conclusao).toLocaleDateString("pt-BR")}`
                        : ""}
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
