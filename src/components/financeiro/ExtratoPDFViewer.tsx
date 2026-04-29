import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarExtratoPDF, type ExtratoPDFPayload } from "@/lib/pdf/gerarExtratoPDF";

const fmtCurrency = (value: number | null | undefined) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (value: string | null | undefined) => value ? new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";
const generatedAt = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const aparelhoImei = (item: ExtratoPDFPayload["extrato"][number]) => [item.modelo_aparelho, item.imei ? `IMEI ${item.imei}` : null].filter(Boolean).join(" • ") || "—";
const servicosLabel = (item: ExtratoPDFPayload["extrato"][number]) => item.tipo === "pagamento" ? item.descricao.replace(/^Pagamento\s*/i, "") || "—" : item.servicos_realizados || "—";

export function ExtratoPDFViewer({ payload }: { payload: ExtratoPDFPayload }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4" /> Preview do extrato
        </div>
        <Button onClick={() => baixarExtratoPDF(payload)} className="gap-2">
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{payload.empresa?.nome || "AssistPro"}</p>
            <h2 className="mt-1 text-2xl font-semibold">Extrato de Cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[payload.empresa?.cnpj, payload.empresa?.telefone, payload.empresa?.email].filter(Boolean).join(" • ")}
            </p>
          </div>
          <div className="text-sm text-muted-foreground md:text-right">
            <p>Período: <span className="font-medium text-foreground">{fmtDate(payload.periodo.inicio)} a {fmtDate(payload.periodo.fim)}</span></p>
            <p>Geração: <span className="font-medium text-foreground">{generatedAt()}</span></p>
          </div>
        </div>

        <div className="grid gap-3 border-b py-4 md:grid-cols-3">
          <Info label="Cliente" value={payload.cliente.nome} />
          <Info label="Telefone" value={payload.cliente.whatsapp || payload.cliente.telefone || "—"} />
          <Info label="CPF/CNPJ" value={payload.cliente.cpf || "—"} />
        </div>

        <div className="grid gap-3 py-4 md:grid-cols-3">
          <Summary label="Total faturado no período" value={fmtCurrency(payload.resumo.totalFaturadoPeriodo)} />
          <Summary label="Total recebido no período" value={fmtCurrency(payload.resumo.totalRecebidoPeriodo)} valueClassName="text-success" />
          <Summary label="Saldo devedor atual" value={fmtCurrency(payload.resumo.saldoDevedorAtual)} valueClassName={payload.resumo.saldoDevedorAtual > 0 ? "text-destructive" : "text-success"} />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="data-table min-w-[1120px]">
            <thead>
              <tr>
                <th>Data</th>
                <th>OS</th>
                <th>Aparelho/IMEI</th>
                <th>Serviço(s)</th>
                <th className="text-right">Débito</th>
                <th className="text-right">Crédito</th>
                <th className="text-right">Saldo após</th>
              </tr>
            </thead>
            <tbody>
              {payload.extrato.map((item) => (
                <tr key={`${item.tipo}-${item.referencia_id}-${item.data}`} className={item.tipo === "pagamento" ? "bg-success/10" : ""}>
                  <td className="text-sm text-muted-foreground">{fmtDate(item.data)}</td>
                  <td className="text-sm font-medium">{item.descricao}</td>
                  <td className="max-w-xs whitespace-normal text-sm text-muted-foreground">{aparelhoImei(item)}</td>
                  <td className="max-w-xs whitespace-normal text-sm text-muted-foreground">{servicosLabel(item)}</td>
                  <td className="text-right text-sm">{Number(item.debito) > 0 ? fmtCurrency(item.debito) : "—"}</td>
                  <td className="text-right text-sm text-success">{Number(item.credito) > 0 ? fmtCurrency(item.credito) : "—"}</td>
                  <td className="text-right text-sm font-semibold">{fmtCurrency(item.saldo_apos)}</td>
                </tr>
              ))}
              {payload.extrato.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação no período.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="pt-4 text-xs text-muted-foreground">Gerado por AssistPro em {generatedAt()}</p>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

function Summary({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold ${valueClassName}`}>{value}</p></div>;
}
