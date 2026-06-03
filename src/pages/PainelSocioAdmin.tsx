import { useState } from "react";
import { Loader2, Users, ShieldCheck, ArrowDownToLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSociosVisaoAdmin, type SocioVisaoAdmin } from "@/hooks/useSociosVisaoAdmin";
import { RetiradasAprovacao } from "@/components/painel-socio/RetiradasAprovacao";
import { AdminCriarRetiradaDialog } from "@/components/painel-socio/AdminCriarRetiradaDialog";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export default function PainelSocioAdmin() {
  const { data: socios = [], isLoading } = useSociosVisaoAdmin();
  const [criarPara, setCriarPara] = useState<SocioVisaoAdmin | null>(null);

  const totalSaldo = socios.reduce((acc, s) => acc + s.saldo, 0);
  const totalRetirado = socios.reduce((acc, s) => acc + s.total_retirado, 0);
  const totalPendente = socios.reduce((acc, s) => acc + s.retiradas_pendentes, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" /> VISÃO ADMINISTRATIVA · PAINEL DO SÓCIO
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Sócios da empresa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Você administra o financeiro dos sócios. Criar retiradas é permitido; aprovar é
            exclusivo do sócio destinatário.
          </p>
        </div>
      </div>

      {/* KPIs consolidados */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Saldo total a retirar
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{brl(totalSaldo)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Total já retirado
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{brl(totalRetirado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Retiradas pendentes
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{brl(totalPendente)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de sócios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Sócios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : socios.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum sócio cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sócio</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">Creditado</TableHead>
                  <TableHead className="text-right">Já retirado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socios.map((s) => (
                  <TableRow key={s.socio_id}>
                    <TableCell>
                      <div className="font-medium">{s.nome}</div>
                      {s.eh_voce && (
                        <Badge variant="outline" className="text-[10px] mt-1">você</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.percentual.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {brl(s.total_creditado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">
                      {brl(s.total_retirado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {brl(s.saldo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.qtd_pendentes > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {brl(s.retiradas_pendentes)} · {s.qtd_pendentes}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={s.saldo <= 0}
                        onClick={() => setCriarPara(s)}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                        Criar retirada
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Retiradas com aprovação */}
      <RetiradasAprovacao />

      <p className="text-xs text-muted-foreground text-center pt-2">
        Como administrador, você não possui participação acionária e não vê uma "visão pessoal".
        Apenas o sócio destinatário pode aprovar a própria retirada.
      </p>

      <AdminCriarRetiradaDialog
        open={!!criarPara}
        onOpenChange={(v) => !v && setCriarPara(null)}
        socio={
          criarPara
            ? { socio_id: criarPara.socio_id, nome: criarPara.nome, saldo: criarPara.saldo }
            : null
        }
      />
    </div>
  );
}
