import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { useListarFuncionariosRH } from "@/hooks/useRH";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LinhaPlanilha = {
  linha: number;
  raw: Record<string, any>;
  funcionario_id: string | null;
  funcionario_nome: string | null;
  data: string | null;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_volta_almoco: string | null;
  hora_saida: string | null;
  erros: string[];
};

function normalizar(s: string): string {
  return s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseDataValor(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseHora(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return `${m[1].padStart(2, "0")}:${m[2]}:00`;
  }
  if (typeof v === "number") {
    if (v < 0 || v > 1) return null;
    const totalSegs = Math.round(v * 86400);
    const h = Math.floor(totalSegs / 3600);
    const m = Math.floor((totalSegs % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}:00`;
  }
  return null;
}

export default function RHImportPonto() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: funcionarios = [] } = useListarFuncionariosRH();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7));

  const lookupFuncionario = useMemo(() => {
    const porNome = new Map<string, string>();
    const porCpf = new Map<string, string>();
    const porEmail = new Map<string, string>();
    for (const f of funcionarios) {
      porNome.set(normalizar(f.nome), f.id);
      if (f.cpf) porCpf.set(f.cpf.replace(/\D/g, ""), f.id);
      if (f.email) porEmail.set(f.email.toLowerCase(), f.id);
    }
    return { porNome, porCpf, porEmail };
  }, [funcionarios]);

  function resolverFuncionario(linha: any): { id: string | null; nome: string | null } {
    const idDireto = linha.funcionario_id || linha["ID Funcionário"] || linha["id_funcionario"];
    if (idDireto) {
      const f = funcionarios.find((x) => x.id === idDireto);
      if (f) return { id: f.id, nome: f.nome };
    }
    const cpf = linha.cpf || linha.CPF;
    if (cpf) {
      const cpfLimpo = cpf.toString().replace(/\D/g, "");
      const id = lookupFuncionario.porCpf.get(cpfLimpo);
      if (id) {
        const f = funcionarios.find((x) => x.id === id)!;
        return { id, nome: f.nome };
      }
    }
    const email = linha.email || linha.Email || linha["E-mail"];
    if (email) {
      const id = lookupFuncionario.porEmail.get(email.toString().toLowerCase());
      if (id) {
        const f = funcionarios.find((x) => x.id === id)!;
        return { id, nome: f.nome };
      }
    }
    const nome = linha.nome || linha.Nome || linha["Funcionário"] || linha["funcionario"];
    if (nome) {
      const id = lookupFuncionario.porNome.get(normalizar(nome.toString()));
      if (id) {
        const f = funcionarios.find((x) => x.id === id)!;
        return { id, nome: f.nome };
      }
      return { id: null, nome: nome.toString() };
    }
    return { id: null, nome: null };
  }

  const handleArquivo = async (file: File) => {
    setArquivo(file);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const processadas: LinhaPlanilha[] = json.map((row, idx) => {
        const erros: string[] = [];
        const { id: funcId, nome: funcNome } = resolverFuncionario(row);
        if (!funcId)
          erros.push(
            funcNome
              ? `Funcionário "${funcNome}" não encontrado`
              : "Sem identificação de funcionário (nome/cpf/email)"
          );
        const dataVal = row.data || row.Data;
        const data = parseDataValor(dataVal);
        if (!data) erros.push(`Data inválida: "${dataVal}"`);
        const entrada = parseHora(row.entrada || row.Entrada || row["Hora Entrada"] || row.hora_entrada);
        const saidaAlmoco = parseHora(
          row.saida_almoco || row["Saída Almoço"] || row["saida almoco"] || row["Hora Saída Almoço"]
        );
        const voltaAlmoco = parseHora(
          row.volta_almoco || row["Volta Almoço"] || row["volta almoco"] || row["Hora Volta Almoço"]
        );
        const saida = parseHora(row.saida || row.Saída || row.Saida || row["Hora Saída"] || row.hora_saida);
        return {
          linha: idx + 2,
          raw: row,
          funcionario_id: funcId,
          funcionario_nome: funcNome,
          data,
          hora_entrada: entrada,
          hora_saida_almoco: saidaAlmoco,
          hora_volta_almoco: voltaAlmoco,
          hora_saida: saida,
          erros,
        };
      });

      setLinhas(processadas);
      toast.success(`${processadas.length} linhas lidas. Revise antes de importar.`);
    } catch (err: any) {
      toast.error("Erro ao ler planilha: " + err.message);
    }
  };

  const importar = useMutation({
    mutationFn: async () => {
      const validas = linhas.filter((l) => l.erros.length === 0);
      const entradas = validas.map((l) => ({
        funcionario_id: l.funcionario_id,
        data: l.data,
        hora_entrada: l.hora_entrada,
        hora_saida_almoco: l.hora_saida_almoco,
        hora_volta_almoco: l.hora_volta_almoco,
        hora_saida: l.hora_saida,
      }));
      const { data, error } = await (supabase as any).rpc("importar_ponto_planilha", {
        p_arquivo_nome: arquivo?.name ?? "import",
        p_mes_referencia: mesReferencia,
        p_entradas: entradas,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: (r: any) => {
      toast.success(
        `Importação concluída! ${r.linhas_processadas} de ${r.linhas_total} processadas.`
      );
      qc.invalidateQueries({ queryKey: ["rh"] });
      setLinhas([]);
      setArquivo(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const baixarModelo = () => {
    const dados = [
      {
        nome: "João Silva",
        data: "2026-05-15",
        entrada: "08:00",
        saida_almoco: "12:00",
        volta_almoco: "13:00",
        saida: "18:00",
      },
      {
        nome: "Maria Santos",
        data: "2026-05-15",
        entrada: "09:00",
        saida_almoco: "12:30",
        volta_almoco: "13:30",
        saida: "18:30",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ponto");
    XLSX.writeFile(wb, "modelo-ponto-ditt.xlsx");
  };

  const linhasComErro = linhas.filter((l) => l.erros.length > 0);
  const linhasValidas = linhas.filter((l) => l.erros.length === 0);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/rh")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Importar ponto</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Carregue planilha Excel/CSV com batidas do mês
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={baixarModelo}>
          <Download className="h-4 w-4 mr-2" /> Baixar modelo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como importar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Sua planilha deve ter cabeçalho com colunas (alguns nomes aceitos):</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Identificador: <code>nome</code>, <code>cpf</code> ou <code>email</code></li>
            <li><code>data</code>: YYYY-MM-DD ou DD/MM/YYYY</li>
            <li><code>entrada</code>, <code>saida_almoco</code>, <code>volta_almoco</code>, <code>saida</code>: HH:MM</li>
          </ul>
          <p>2. Sistema valida e mostra preview antes de importar.</p>
          <p>3. Linhas com erro ficam destacadas — corrija e tente de novo.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês de referência</Label>
              <Input
                type="month"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Arquivo Excel ou CSV</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleArquivo(e.target.files[0])}
                className="cursor-pointer"
              />
              {arquivo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  {arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {linhas.length > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {linhasValidas.length} válidas
            </Badge>
            {linhasComErro.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {linhasComErro.length} com erro
              </Badge>
            )}
            <Button
              onClick={() => importar.mutate()}
              disabled={importar.isPending || linhasValidas.length === 0}
              className="ml-auto"
            >
              {importar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar {linhasValidas.length} linhas
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Entrada</th>
                    <th className="p-3">Almoço (saída)</th>
                    <th className="p-3">Almoço (volta)</th>
                    <th className="p-3">Saída</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, idx) => (
                    <tr
                      key={idx}
                      className={`border-t ${l.erros.length > 0 ? "bg-destructive/5" : ""}`}
                    >
                      <td className="p-3 text-muted-foreground">{l.linha}</td>
                      <td className="p-3">
                        {l.funcionario_id ? (
                          <span>{l.funcionario_nome}</span>
                        ) : (
                          <span className="text-destructive">{l.funcionario_nome ?? "—"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {l.data ?? <span className="text-destructive">inválida</span>}
                      </td>
                      <td className="p-3">{l.hora_entrada ?? "—"}</td>
                      <td className="p-3">{l.hora_saida_almoco ?? "—"}</td>
                      <td className="p-3">{l.hora_volta_almoco ?? "—"}</td>
                      <td className="p-3">{l.hora_saida ?? "—"}</td>
                      <td className="p-3">
                        {l.erros.length === 0 ? (
                          <Badge variant="secondary">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {l.erros[0]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
