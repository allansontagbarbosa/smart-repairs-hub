import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, FileText, CheckCircle2, Loader2, ChevronRight, Search, Upload } from "lucide-react";
import { useListarFuncionariosRH, useGerarFolhaMensal } from "@/hooks/useRH";
import { TIPO_VINCULO_LABELS } from "@/types/rh";
import { toast } from "sonner";

const fmt = (c: number) => (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RH() {
  const navigate = useNavigate();
  const { data: funcionarios = [], isLoading } = useListarFuncionariosRH();
  const gerarFolha = useGerarFolhaMensal();
  const [busca, setBusca] = useState("");

  const hoje = new Date();
  const competenciaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const handleGerarFolha = async () => {
    if (!confirm(`Gerar folha de ${competenciaAtual}? Isso lançará salários (CLT), VT e VA pra todos funcionários ativos com valores cadastrados.`)) return;
    try {
      const r = await gerarFolha.mutateAsync(competenciaAtual);
      toast.success(`Folha gerada: ${r.funcionarios_processados} funcionários, total ${fmt((r.total_salarios_centavos ?? 0) + (r.total_vt_centavos ?? 0) + (r.total_va_centavos ?? 0))}`);
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
  };

  const funcionariosFiltrados = funcionarios.filter(f =>
    !busca ||
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.cargo?.toLowerCase().includes(busca.toLowerCase()) ||
    f.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPendente = funcionarios.reduce((s, f) => s + (f.pendente_pagamento_centavos ?? 0), 0);
  const ativos = funcionarios.filter(f => f.ativo).length;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recursos Humanos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Funcionários, salários, banco de horas, ponto e holerite
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/rh/importar-ponto")}>
            <Upload className="h-4 w-4 mr-2" />
            Importar ponto
          </Button>
          <Button onClick={handleGerarFolha} disabled={gerarFolha.isPending}>
            {gerarFolha.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Gerar folha de {competenciaAtual}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Funcionários ativos
              <Users className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2">{ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Total pendente a pagar
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2">{fmt(totalPendente)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Competência atual
              <FileText className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2">{competenciaAtual}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {funcionariosFiltrados.map(f => (
            <Link
              key={f.id}
              to={`/rh/${f.id}`}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                {f.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{f.nome}</p>
                  {!f.ativo && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {f.cargo ?? "Sem cargo"} • {TIPO_VINCULO_LABELS[f.tipo_vinculo]}
                  {f.salario_centavos ? ` • ${fmt(f.salario_centavos)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                {f.pendente_pagamento_centavos > 0 && (
                  <p className="text-sm font-semibold text-amber-600">{fmt(f.pendente_pagamento_centavos)}</p>
                )}
                <p className="text-[10px] text-muted-foreground">a receber</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
          {funcionariosFiltrados.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">Nenhum funcionário encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
