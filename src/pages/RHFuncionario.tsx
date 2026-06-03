import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit3, CalendarOff, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  useListarFuncionariosRH, useExtratoFuncionario, useHolerite, useBancoHoras,
  usePagarMovimentacoes, useAplicarAcaoBancoHoras, useToggleFuncionarioRH,
} from "@/hooks/useRH";
import { TIPO_VINCULO_LABELS, TIPO_MOV_LABELS } from "@/types/rh";
import { EditarFuncionarioDialog } from "@/components/rh/EditarFuncionarioDialog";
import { RegistrarFaltaDialog } from "@/components/rh/RegistrarFaltaDialog";
import { JornadaTab } from "@/components/rh/JornadaTab";
import { HoleriteDetalhadoTab } from "@/components/rh/HoleriteDetalhadoTab";
import { toast } from "sonner";

const fmt = (c: number) => (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => new Date(s).toLocaleDateString("pt-BR");

export default function RHFuncionario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editarOpen, setEditarOpen] = useState(false);
  const [faltaOpen, setFaltaOpen] = useState(false);

  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );

  const { data: funcionarios = [] } = useListarFuncionariosRH();
  const func = funcionarios.find(f => f.id === id);

  const { data: extrato } = useExtratoFuncionario(id || null);
  const { data: holerite } = useHolerite(id || null, competencia);
  const { data: bancoHoras } = useBancoHoras(id || null, competencia);
  const pagar = usePagarMovimentacoes();
  const aplicarAcao = useAplicarAcaoBancoHoras();
  const toggleRH = useToggleFuncionarioRH();

  const handleToggleRH = async (checked: boolean) => {
    if (!checked && !confirm(`Remover ${func?.nome ?? "funcionário"} do RH? Ele(a) continuará com acesso ao sistema, mas não aparecerá em folhas/holerites.`)) return;
    try {
      await toggleRH.mutateAsync({ id: id!, eh_funcionario_rh: checked });
      toast.success(checked ? "Marcado como funcionário RH" : "Removido do RH");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pendentes = (extrato?.movimentacoes ?? []).filter((m: any) => m.status === "pendente");

  const handlePagarTodas = async () => {
    if (pendentes.length === 0) return;
    const total = pendentes.reduce((s: number, m: any) => s + m.valor_centavos, 0);
    if (!confirm(`Marcar ${pendentes.length} movimentações como pagas? Total: ${fmt(total)}`)) return;
    try {
      const r = await pagar.mutateAsync({ ids: pendentes.map((m: any) => m.id) });
      toast.success(`${r.movimentacoes_pagas} pagamentos marcados (${fmt(r.total_centavos)})`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAcaoBancoHoras = async (acao: "pagar_extra" | "manter_banco") => {
    if (!bancoHoras?.tem_excedente) return;
    try {
      await aplicarAcao.mutateAsync({
        funcionario_id: id!,
        competencia,
        horas: bancoHoras.saldo_horas,
        acao,
      });
      toast.success(acao === "pagar_extra" ? "Hora extra registrada" : "Mantido em banco");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!func) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/rh")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground">Funcionário não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/rh")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 text-primary text-lg font-semibold">
            {func.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{func.nome}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{TIPO_VINCULO_LABELS[func.tipo_vinculo]}</Badge>
              {func.cargo && <Badge variant="secondary">{func.cargo}</Badge>}
              {!func.ativo && <Badge variant="destructive">Inativo</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card">
            <Switch
              checked={func.eh_funcionario_rh}
              onCheckedChange={handleToggleRH}
              disabled={toggleRH.isPending}
            />
            <span className="text-xs text-muted-foreground">Funcionário RH</span>
          </div>
          <Button variant="outline" onClick={() => setEditarOpen(true)}>
            <Edit3 className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Salário</p>
            <p className="text-xl font-semibold mt-1">{func.salario_centavos ? fmt(func.salario_centavos) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente a pagar</p>
            <p className="text-xl font-semibold mt-1 text-amber-600">{fmt(extrato?.total_pendente_centavos ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total pago (período)</p>
            <p className="text-xl font-semibold mt-1">{fmt(extrato?.total_pago_centavos ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="extrato" className="space-y-4">
        <TabsList>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="holerite">Holerite</TabsTrigger>
          <TabsTrigger value="banco">Banco de horas</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="dados">Dados pessoais</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Conta do funcionário</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFaltaOpen(true)}>
                <CalendarOff className="h-4 w-4 mr-1" /> Registrar falta
              </Button>
              {pendentes.length > 0 && (
                <Button size="sm" onClick={handlePagarTodas} disabled={pagar.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Pagar pendentes ({pendentes.length})
                </Button>
              )}
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(extrato?.movimentacoes ?? []).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{fmtData(m.data)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TIPO_MOV_LABELS[m.tipo as keyof typeof TIPO_MOV_LABELS] ?? m.tipo}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{m.descricao || "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${m.valor_centavos < 0 ? "text-destructive" : ""}`}>
                        {fmt(m.valor_centavos)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "pago" ? "default" : m.status === "pendente" ? "secondary" : "outline"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(extrato?.movimentacoes ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma movimentação. Use "Gerar folha do mês" pra começar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holerite" className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Competência:</label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          {holerite && (
            <Card>
              <CardHeader>
                <CardTitle>Holerite — {competencia}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">PROVENTOS</p>
                  {(holerite.movimentacoes ?? []).filter((m: any) => m.valor_centavos > 0).map((m: any) => (
                    <div key={m.id} className="flex justify-between py-1 text-sm">
                      <span>{m.descricao || TIPO_MOV_LABELS[m.tipo as keyof typeof TIPO_MOV_LABELS]}</span>
                      <span>{fmt(m.valor_centavos)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                    <span>Total proventos</span>
                    <span>{fmt(holerite.total_proventos_centavos)}</span>
                  </div>
                </div>

                {holerite.total_descontos_centavos > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">DESCONTOS</p>
                    {(holerite.movimentacoes ?? []).filter((m: any) => m.valor_centavos < 0).map((m: any) => (
                      <div key={m.id} className="flex justify-between py-1 text-sm">
                        <span>{m.descricao || TIPO_MOV_LABELS[m.tipo as keyof typeof TIPO_MOV_LABELS]}</span>
                        <span className="text-destructive">{fmt(m.valor_centavos)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2 mt-2 text-destructive">
                      <span>Total descontos</span>
                      <span>{fmt(-holerite.total_descontos_centavos)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>LÍQUIDO</span>
                  <span className={holerite.liquido_centavos > 0 ? "text-green-700" : "text-destructive"}>
                    {fmt(holerite.liquido_centavos)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-3">
                  <p>Horas trabalhadas: {Number(holerite.horas_trabalhadas ?? 0).toFixed(1)}h</p>
                  <p>Dias trabalhados: {holerite.dias_trabalhados ?? 0}</p>
                  <p>Faltas: {holerite.faltas ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="banco" className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Competência:</label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          {bancoHoras && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Horas esperadas</p>
                    <p className="text-xl font-semibold">{Number(bancoHoras.horas_esperadas ?? 0).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horas trabalhadas</p>
                    <p className="text-xl font-semibold">{Number(bancoHoras.horas_trabalhadas ?? 0).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className={`text-xl font-semibold ${bancoHoras.saldo_horas > 0 ? "text-green-700" : bancoHoras.saldo_horas < 0 ? "text-destructive" : ""}`}>
                      {bancoHoras.saldo_horas > 0 ? "+" : ""}{Number(bancoHoras.saldo_horas ?? 0).toFixed(1)}h
                    </p>
                  </div>
                </div>

                {bancoHoras.tem_excedente && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 dark:bg-amber-950/20 dark:border-amber-900">
                    <p className="text-sm">
                      Funcionário trabalhou {Number(bancoHoras.saldo_horas).toFixed(1)}h a mais. O que fazer?
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => handleAcaoBancoHoras("pagar_extra")} disabled={aplicarAcao.isPending}>
                        Pagar como hora extra
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAcaoBancoHoras("manter_banco")} disabled={aplicarAcao.isPending}>
                        Manter em banco
                      </Button>
                    </div>
                  </div>
                )}

                {bancoHoras.tem_devedoras && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm">
                      Funcionário está com {Math.abs(Number(bancoHoras.saldo_horas)).toFixed(1)}h em débito.
                    </p>
                  </div>
                )}

                {!bancoHoras.tem_excedente && !bancoHoras.tem_devedoras && (
                  <p className="text-sm text-muted-foreground">
                    Saldo zerado pra esta competência. Importe o ponto pra ver dados.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jornada" className="space-y-4">
          <JornadaTab funcionarioId={func.id} funcionarioNome={func.nome} />
        </TabsContent>

        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label="Nome" valor={func.nome} />
              <Row label="CPF" valor={func.cpf} />
              <Row label="Email" valor={func.email} />
              <Row label="Telefone" valor={func.telefone} />
              <Row label="Cargo" valor={func.cargo} />
              <Row label="Tipo de vínculo" valor={TIPO_VINCULO_LABELS[func.tipo_vinculo]} />
              <Row label="Data de admissão" valor={func.data_admissao ? fmtData(func.data_admissao) : null} />
              <Row label="Carga semanal" valor={func.carga_horaria_semanal ? `${func.carga_horaria_semanal}h` : null} />
              <Row label="Salário" valor={func.salario_centavos ? fmt(func.salario_centavos) : null} />
              <Row label="VT mensal" valor={func.vt_centavos > 0 ? fmt(func.vt_centavos) : null} />
              <Row label="VA mensal" valor={func.va_centavos > 0 ? fmt(func.va_centavos) : null} />
              <Row label="Status" valor={func.ativo ? "Ativo" : "Inativo"} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editarOpen && (
        <EditarFuncionarioDialog open={editarOpen} onOpenChange={setEditarOpen} funcionario={func} />
      )}
      {faltaOpen && (
        <RegistrarFaltaDialog open={faltaOpen} onOpenChange={setFaltaOpen} funcionarioId={func.id} funcionarioNome={func.nome} />
      )}
    </div>
  );
}

function Row({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor || "—"}</span>
    </div>
  );
}
