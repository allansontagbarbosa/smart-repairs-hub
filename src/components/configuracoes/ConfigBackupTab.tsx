import { useState, useRef } from "react";
import { Download, Mail, Upload, AlertTriangle, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useGerarBackup, useImportarBackup, useBackupHistorico, useBackupConfig, useSalvarBackupConfig,
} from "@/hooks/useBackup";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function ConfigBackupTab() {
  const config = useBackupConfig();
  const salvar = useSalvarBackupConfig();
  const gerar = useGerarBackup();
  const importar = useImportarBackup();
  const historico = useBackupHistorico();

  const [emailDestino, setEmailDestino] = useState("");
  const [frequencia, setFrequencia] = useState("desativado");
  const [diaSemana, setDiaSemana] = useState<number>(1);
  const [hora, setHora] = useState(3);

  // sync from config
  const cfg = config.data;
  const initRef = useRef(false);
  if (cfg && !initRef.current) {
    initRef.current = true;
    setEmailDestino(cfg.backup_email_destino || cfg.email || "");
    setFrequencia(cfg.backup_frequencia || "desativado");
    setDiaSemana(cfg.backup_dia_semana ?? 1);
    setHora(cfg.backup_hora ?? 3);
  }

  // Import state
  const [backupJson, setBackupJson] = useState<any>(null);
  const [importFileName, setImportFileName] = useState("");
  const [modoImport, setModoImport] = useState<"merge" | "replace">("merge");
  const [confirmacaoNome, setConfirmacaoNome] = useState("");

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        setBackupJson(json);
      } catch {
        setBackupJson(null);
        alert("Arquivo JSON inválido");
      }
    };
    reader.readAsText(file);
  }

  const previewCount = backupJson
    ? Object.entries(backupJson)
        .filter(([k, v]) => !k.startsWith("_") && Array.isArray(v))
        .reduce((acc, [, v]: any) => acc + v.length, 0)
    : 0;
  const previewTabelas = backupJson
    ? Object.keys(backupJson).filter((k) => !k.startsWith("_") && Array.isArray(backupJson[k])).length
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* SEÇÃO 1: Backup manual */}
      <Card className="p-5">
        <h3 className="font-semibold mb-2">Gerar backup agora</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Backup completo de todos os dados da empresa (clientes, OS, peças, financeiro, etc).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => gerar.mutate({ enviar_email: false })} disabled={gerar.isPending}>
            {gerar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar XLSX + JSON
          </Button>
          <Button variant="outline" onClick={() => gerar.mutate({ enviar_email: true })} disabled={gerar.isPending || !emailDestino}>
            <Mail className="h-4 w-4 mr-2" /> Enviar por email
          </Button>
        </div>
        {cfg?.backup_ultimo_envio_em && (
          <p className="text-xs text-muted-foreground mt-3">
            Último envio: {new Date(cfg.backup_ultimo_envio_em).toLocaleString("pt-BR")}
          </p>
        )}
      </Card>

      {/* SEÇÃO 2: Configuração */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Backup automático</h3>
        <div className="space-y-4">
          <div>
            <Label>Email de destino</Label>
            <Input type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} placeholder="email@empresa.com" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Frequência</Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desativado">Desativado</SelectItem>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal (dia 1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frequencia === "semanal" && (
              <div>
                <Label>Dia da semana</Label>
                <Select value={String(diaSemana)} onValueChange={(v) => setDiaSemana(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Hora (UTC)</Label>
              <Input type="number" min={0} max={23} value={hora} onChange={(e) => setHora(Number(e.target.value))} />
            </div>
          </div>
          <Button
            onClick={() =>
              salvar.mutate({
                backup_email_destino: emailDestino || null,
                backup_frequencia: frequencia,
                backup_dia_semana: frequencia === "semanal" ? diaSemana : null,
                backup_hora: hora,
              })
            }
            disabled={salvar.isPending}
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configuração
          </Button>
        </div>
      </Card>

      {/* SEÇÃO 3: Histórico */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de backups
        </h3>
        {historico.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !historico.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum backup gerado ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Tabelas</th>
                  <th className="py-2 pr-3">Registros</th>
                  <th className="py-2 pr-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {historico.data.map((h: any) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(h.iniciado_em).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-3">{h.tipo}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={h.status === "sucesso" ? "default" : h.status === "erro" ? "destructive" : "secondary"}>
                        {h.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{h.tabelas_incluidas?.length ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {h.contagem_registros
                        ? Object.values(h.contagem_registros as Record<string, number>).reduce((s, n) => s + (n || 0), 0)
                        : "-"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{h.email_destino || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SEÇÃO 4: Importar (perigosa) */}
      <Card className="p-5 border-destructive/50">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">Restaurar backup (irreversível)</h3>
            <p className="text-sm text-muted-foreground">
              Importar um backup pode sobrescrever os dados atuais. Um snapshot do estado atual será salvo automaticamente antes.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Arquivo JSON do backup</Label>
            <Input type="file" accept=".json,application/json" onChange={handleUpload} />
            {importFileName && (
              <p className="text-xs text-muted-foreground mt-1">
                {importFileName} — {previewCount} registros em {previewTabelas} tabelas
              </p>
            )}
          </div>

          {backupJson && (
            <>
              <div>
                <Label>Modo de importação</Label>
                <RadioGroup value={modoImport} onValueChange={(v: any) => setModoImport(v)} className="mt-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="merge" id="merge" />
                    <label htmlFor="merge" className="text-sm cursor-pointer">
                      <strong>Merge</strong> — atualiza pelos ids existentes, preserva dados não presentes no backup
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="replace" id="replace" />
                    <label htmlFor="replace" className="text-sm cursor-pointer text-destructive">
                      <strong>Replace</strong> — DELETA tudo da empresa e recoloca do backup
                    </label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Digite o nome da empresa pra confirmar</Label>
                <Input
                  value={confirmacaoNome}
                  onChange={(e) => setConfirmacaoNome(e.target.value)}
                  placeholder="Nome exato da empresa"
                />
              </div>

              <Button
                variant="destructive"
                disabled={!confirmacaoNome || importar.isPending}
                onClick={() =>
                  importar.mutate({
                    backup_json: backupJson,
                    modo: modoImport,
                    confirmacao_nome_empresa: confirmacaoNome,
                  })
                }
              >
                {importar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar backup (irreversível)
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
