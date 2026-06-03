import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Download, FileText } from "lucide-react";
import { useMeuEspelhoPonto } from "@/hooks/useJornada";
import { useMeuHolerite } from "@/hooks/useMeuHolerite";
import { useEmpresaParaHolerite } from "@/hooks/useHoleriteDetalhado";
import { baixarHoleritePDF } from "@/lib/pdf/gerarHoleritePDF";
import { toast } from "sonner";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const fmtH = (h?: number | null) =>
  h == null ? "—" : `${Number(h ?? 0).toFixed(1)}h`;

const fmtData = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const horaCurta = (s?: string | null) => (s ? s.slice(0, 5) : "—");

export default function MeuPonto() {
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );

  const { data, isLoading, error } = useMeuEspelhoPonto(competencia);
  const { data: holerite } = useMeuHolerite(competencia);
  const { data: empresa } = useEmpresaParaHolerite();

  const fmtBRL = (c: number) =>
    (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleBaixarHolerite = () => {
    if (!holerite || (holerite.eventos?.length ?? 0) === 0) {
      toast.error("Holerite ainda não montado para esta competência. Peça para o RH.");
      return;
    }
    baixarHoleritePDF({
      empresa: empresa ?? { nome: "Empresa" },
      funcionario: holerite.funcionario,
      competencia,
      eventos: holerite.eventos,
      total_proventos_centavos: holerite.total_proventos_centavos,
      total_descontos_centavos: holerite.total_descontos_centavos,
      liquido_centavos: holerite.liquido_centavos,
      horas_trabalhadas: holerite.horas_trabalhadas,
      dias_trabalhados: holerite.dias_trabalhados,
      faltas: holerite.faltas,
    });
  };

  const banco = data?.banco ?? {};
  const batidas: any[] = data?.batidas ?? [];
  const dias: any[] = banco?.dias ?? [];

  // merge dias (com previsto/saldo) com batidas (horários)
  const linhas = (() => {
    const mp = new Map<string, any>();
    dias.forEach((d) => mp.set(d.data, { ...d }));
    batidas.forEach((b) => {
      const cur = mp.get(b.data) ?? { data: b.data, dia_semana: new Date(b.data + "T00:00:00").getDay() };
      mp.set(b.data, { ...cur, ...b });
    });
    return Array.from(mp.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
  })();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meu ponto</h1>
          <p className="text-sm text-muted-foreground">Espelho de ponto e banco de horas do mês.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Competência:</label>
        <input
          type="month"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Horas esperadas</p>
            <p className="text-xl font-semibold mt-1">{fmtH(banco?.horas_esperadas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Horas trabalhadas</p>
            <p className="text-xl font-semibold mt-1">{fmtH(banco?.horas_trabalhadas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo do mês</p>
            <p
              className={`text-xl font-semibold mt-1 ${
                Number(banco?.saldo_horas ?? 0) > 0
                  ? "text-green-700"
                  : Number(banco?.saldo_horas ?? 0) < 0
                  ? "text-destructive"
                  : ""
              }`}
            >
              {Number(banco?.saldo_horas ?? 0) > 0 ? "+" : ""}
              {fmtH(banco?.saldo_horas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {banco && banco.tem_jornada === false && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Sua jornada ainda não foi cadastrada. Peça para o RH cadastrar para o cálculo ficar correto.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Almoço</TableHead>
                <TableHead>Volta</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Trabalhado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma batida nesse mês.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l) => {
                const saldo = Number(l.saldo ?? 0);
                return (
                  <TableRow key={l.data}>
                    <TableCell>{fmtData(l.data)}</TableCell>
                    <TableCell>
                      {l.folga ? <Badge variant="outline">Folga</Badge> : DIAS[l.dia_semana ?? 0]}
                    </TableCell>
                    <TableCell>{horaCurta(l.hora_entrada)}</TableCell>
                    <TableCell>{horaCurta(l.hora_saida_almoco)}</TableCell>
                    <TableCell>{horaCurta(l.hora_volta_almoco)}</TableCell>
                    <TableCell>{horaCurta(l.hora_saida)}</TableCell>
                    <TableCell className="text-right">{fmtH(l.previsto)}</TableCell>
                    <TableCell className="text-right">{fmtH(l.trabalhado)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        saldo > 0 ? "text-green-700" : saldo < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {l.saldo == null ? "—" : `${saldo > 0 ? "+" : ""}${saldo.toFixed(1)}h`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
