import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";
import { useListarTodosFuncionarios, useToggleFuncionarioRH } from "@/hooks/useRH";
import { toast } from "sonner";

export default function RHGerenciarFuncionarios() {
  const navigate = useNavigate();
  const { data: todos = [], isLoading } = useListarTodosFuncionarios();
  const toggle = useToggleFuncionarioRH();

  const handleToggle = async (id: string, novoValor: boolean, nome: string) => {
    try {
      await toggle.mutateAsync({ id, eh_funcionario_rh: novoValor });
      toast.success(novoValor ? `${nome} marcado como funcionário RH` : `${nome} removido do RH`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const rhCount = todos.filter((f) => f.eh_funcionario_rh).length;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rh")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gerenciar funcionários do RH</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marque quem aparece como funcionário no RH. {rhCount} de {todos.length} marcados.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            Usuários do sistema
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Funcionários NÃO marcados continuam podendo usar o sistema normalmente. Eles só não
            aparecem na folha de pagamento, holerite e cálculos de RH.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                    {f.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{f.nome}</p>
                      {!f.ativo && <Badge variant="secondary">Inativo</Badge>}
                      {f.eh_funcionario_rh && <Badge>RH</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {f.cargo ?? "Sem cargo"} • {f.email ?? "sem email"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {f.eh_funcionario_rh ? "É funcionário RH" : "Não é RH"}
                    </span>
                    <Switch
                      checked={f.eh_funcionario_rh}
                      onCheckedChange={(checked) => handleToggle(f.id, checked, f.nome)}
                      disabled={toggle.isPending}
                    />
                  </div>
                </div>
              ))}
              {todos.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum funcionário cadastrado.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dica: Marque apenas pessoas a quem você paga (CLT, PJ, MEI, diarista). Sócios,
        administradores e usuários convidados que NÃO recebem salário pela Ditt devem ficar
        desmarcados — eles continuam com acesso ao sistema, mas não aparecem em folhas, holerites
        e cálculos de RH.
      </p>
    </div>
  );
}
