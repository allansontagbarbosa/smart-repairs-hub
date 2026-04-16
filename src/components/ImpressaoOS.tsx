import { forwardRef } from "react";
import { formatNumeroOS } from "@/lib/numeroOS";
import { statusLabels, type Status } from "@/lib/status";

export interface ImpressaoOSData {
  numero: number | null;
  numero_formatado: string | null;
  status: string;
  data_entrada: string;
  previsao_entrega: string | null;
  defeito_relatado: string | null;
  diagnostico_tecnico?: string | null;
  obs_cliente?: string | null;
  observacoes_internas?: string | null;
  servico_descricao?: string | null;
  valor: number | null;
  valor_total: number | null;
  desconto?: number | null;
  sinal_pago?: number | null;
  forma_pagamento_sinal?: string | null;
  garantia_dias?: number | null;
  mao_obra_adicional?: number | null;
  acessorios?: string | null;
  senha_padrao?: string | null;
  checklist_entrada?: Record<string, string> | null;
  cliente: {
    nome: string;
    telefone: string;
    cpf?: string | null;
    email?: string | null;
  };
  aparelho: {
    marca: string;
    modelo: string;
    cor?: string | null;
    capacidade?: string | null;
    imei?: string | null;
  };
  empresa?: {
    nome: string;
    cnpj?: string | null;
    telefone?: string | null;
    email?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    logo_url?: string | null;
  } | null;
  pecas?: Array<{
    nome: string;
    quantidade: number;
    valor?: number | null;
  }>;
  tecnico_nome?: string | null;
}

const CHECKLIST_LABELS: Record<string, string> = {
  liga: "Liga normalmente",
  tela: "Tela (sem trinco, sem manchas)",
  touch: "Touch responde",
  biometria: "Face ID / Touch ID",
  bateria: "Bateria",
  camera_traseira: "Câmera traseira",
  camera_frontal: "Câmera frontal",
  alto_falante: "Alto-falante / fone",
  microfone: "Microfone",
  botoes: "Botões (power, volume, mute)",
  vibracao: "Vibração",
  wifi_bluetooth: "Wi-Fi / Bluetooth",
  conector_carga: "Conector de carga",
};

const STATUS_LABEL_CHECKLIST: Record<string, string> = {
  ok: "OK",
  defeito: "Com defeito",
  nao_testado: "Não testado",
};

const fmtMoney = (v: number | null | undefined) =>
  v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

export const ImpressaoOS = forwardRef<HTMLDivElement, { data: ImpressaoOSData }>(
  ({ data }, ref) => {
    const numero = formatNumeroOS(data.numero, data.numero_formatado);
    const checklist = data.checklist_entrada || {};
    const checklistEntries = Object.entries(checklist).filter(([, v]) => v && v !== "nao_testado");
    const subtotalPecas = (data.pecas || []).reduce(
      (s, p) => s + (p.valor ?? 0) * p.quantidade,
      0,
    );
    const valorServico = data.valor ?? 0;
    const valorTotal = data.valor_total ?? valorServico + subtotalPecas;
    const aReceber = Math.max(0, valorTotal - (data.sinal_pago ?? 0) - (data.desconto ?? 0));

    const enderecoEmpresa = [
      data.empresa?.endereco,
      data.empresa?.cidade,
      data.empresa?.estado,
    ]
      .filter(Boolean)
      .join(" - ");

    return (
      <div
        ref={ref}
        className="impressao-os bg-white text-black mx-auto"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "12mm 14mm",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11px",
          lineHeight: 1.4,
        }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center gap-3">
            {data.empresa?.logo_url && (
              <img
                src={data.empresa.logo_url}
                alt="Logo"
                style={{ maxHeight: 56, maxWidth: 120, objectFit: "contain" }}
              />
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {data.empresa?.nome || "—"}
              </div>
              {data.empresa?.cnpj && <div>CNPJ: {data.empresa.cnpj}</div>}
              {enderecoEmpresa && <div>{enderecoEmpresa}</div>}
              <div>
                {data.empresa?.telefone && <>Tel: {data.empresa.telefone} </>}
                {data.empresa?.email && <>· {data.empresa.email}</>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Ordem de Serviço
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              #{numero}
            </div>
            <div className="mt-1">
              Status: <strong>{statusLabels[data.status as Status] || data.status}</strong>
            </div>
            <div>Entrada: {fmtDateTime(data.data_entrada)}</div>
            {data.previsao_entrega && (
              <div>Previsão: {fmtDateTime(data.previsao_entrega)}</div>
            )}
          </div>
        </div>

        {/* Cliente + Aparelho */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <section>
            <h3 style={sectionTitle}>Cliente</h3>
            <div><strong>{data.cliente.nome}</strong></div>
            <div>Telefone: {data.cliente.telefone || "—"}</div>
            {data.cliente.cpf && <div>CPF: {data.cliente.cpf}</div>}
            {data.cliente.email && <div>Email: {data.cliente.email}</div>}
          </section>
          <section>
            <h3 style={sectionTitle}>Aparelho</h3>
            <div>
              <strong>
                {data.aparelho.marca} {data.aparelho.modelo}
              </strong>
            </div>
            {data.aparelho.cor && <div>Cor: {data.aparelho.cor}</div>}
            {data.aparelho.capacidade && <div>Capacidade: {data.aparelho.capacidade}</div>}
            {data.aparelho.imei && <div>IMEI: {data.aparelho.imei}</div>}
            {data.acessorios && <div>Acessórios: {data.acessorios}</div>}
            {data.senha_padrao && <div>Senha: {data.senha_padrao}</div>}
          </section>
        </div>

        {/* Defeito + Diagnóstico */}
        <section className="mb-4">
          <h3 style={sectionTitle}>Defeito relatado</h3>
          <div style={boxed}>{data.defeito_relatado || "—"}</div>
          {data.diagnostico_tecnico && (
            <>
              <h3 style={{ ...sectionTitle, marginTop: 8 }}>Diagnóstico técnico</h3>
              <div style={boxed}>{data.diagnostico_tecnico}</div>
            </>
          )}
        </section>

        {/* Checklist */}
        {checklistEntries.length > 0 && (
          <section className="mb-4">
            <h3 style={sectionTitle}>Conferência na entrada</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {checklistEntries.map(([key, status]) => (
                  <tr key={key} style={{ borderBottom: "1px dotted #999" }}>
                    <td style={{ padding: "3px 4px", width: "70%" }}>
                      {CHECKLIST_LABELS[key] || key}
                    </td>
                    <td
                      style={{
                        padding: "3px 4px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: status === "defeito" ? "#b91c1c" : status === "ok" ? "#15803d" : "#666",
                      }}
                    >
                      {STATUS_LABEL_CHECKLIST[status] || status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Orçamento */}
        <section className="mb-4">
          <h3 style={sectionTitle}>Orçamento</h3>
          {data.servico_descricao && <div className="mb-1">Serviço: {data.servico_descricao}</div>}
          {data.pecas && data.pecas.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={th}>Peça</th>
                  <th style={{ ...th, textAlign: "center", width: 50 }}>Qtd</th>
                  <th style={{ ...th, textAlign: "right", width: 90 }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.pecas.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px dotted #999" }}>
                    <td style={td}>{p.nome}</td>
                    <td style={{ ...td, textAlign: "center" }}>{p.quantidade}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtMoney((p.valor ?? 0) * p.quantidade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 4 }}>
            <span>Serviços</span>
            <strong style={{ textAlign: "right" }}>{fmtMoney(valorServico)}</strong>
            {subtotalPecas > 0 && (
              <>
                <span>Peças</span>
                <strong style={{ textAlign: "right" }}>{fmtMoney(subtotalPecas)}</strong>
              </>
            )}
            {(data.mao_obra_adicional ?? 0) > 0 && (
              <>
                <span>Mão de obra adicional</span>
                <strong style={{ textAlign: "right" }}>{fmtMoney(data.mao_obra_adicional)}</strong>
              </>
            )}
            {(data.desconto ?? 0) > 0 && (
              <>
                <span>Desconto</span>
                <strong style={{ textAlign: "right" }}>- {fmtMoney(data.desconto)}</strong>
              </>
            )}
            <span style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 13 }}>TOTAL</span>
            <strong style={{ borderTop: "1px solid #000", paddingTop: 4, textAlign: "right", fontSize: 13 }}>
              {fmtMoney(valorTotal)}
            </strong>
            {(data.sinal_pago ?? 0) > 0 && (
              <>
                <span>Sinal pago{data.forma_pagamento_sinal ? ` (${data.forma_pagamento_sinal})` : ""}</span>
                <strong style={{ textAlign: "right" }}>{fmtMoney(data.sinal_pago)}</strong>
                <span>A receber na retirada</span>
                <strong style={{ textAlign: "right" }}>{fmtMoney(aReceber)}</strong>
              </>
            )}
          </div>
        </section>

        {data.obs_cliente && (
          <section className="mb-4">
            <h3 style={sectionTitle}>Observações</h3>
            <div style={boxed}>{data.obs_cliente}</div>
          </section>
        )}

        {/* Garantia + termo */}
        <section className="mb-4" style={{ fontSize: 10, color: "#333" }}>
          <h3 style={sectionTitle}>Garantia e termos</h3>
          <p>
            O serviço prestado possui garantia de <strong>{data.garantia_dias ?? 90} dias</strong>{" "}
            a contar da data de entrega, conforme art. 26 do Código de Defesa do Consumidor.
            A garantia cobre exclusivamente o defeito reparado e as peças substituídas, não cobrindo
            danos por mau uso, queda, contato com líquidos ou tentativas de reparo por terceiros.
          </p>
          <p style={{ marginTop: 6 }}>
            Aparelhos não retirados em até <strong>90 dias</strong> após a comunicação de pronto
            poderão ser destinados conforme legislação vigente (Lei 2.313/86 / Decreto 21.981/32).
            O cliente declara ter conferido as condições do aparelho descritas neste documento e
            autoriza a execução dos serviços orçados.
          </p>
        </section>

        {/* Assinaturas */}
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, textAlign: "center" }}>
            {data.cliente.nome}
            <div style={{ fontSize: 10, color: "#555" }}>Assinatura do cliente</div>
          </div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, textAlign: "center" }}>
            {data.tecnico_nome || data.empresa?.nome || "—"}
            <div style={{ fontSize: 10, color: "#555" }}>Responsável</div>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 9, color: "#666", textAlign: "center" }}>
          Documento gerado em {fmtDateTime(new Date().toISOString())} · OS #{numero}
        </div>
      </div>
    );
  },
);

ImpressaoOS.displayName = "ImpressaoOS";

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid #000",
  paddingBottom: 2,
  marginBottom: 4,
};
const boxed: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "6px 8px",
  borderRadius: 4,
  whiteSpace: "pre-wrap",
};
const th: React.CSSProperties = { padding: "4px 4px", textAlign: "left", fontSize: 10, fontWeight: 700 };
const td: React.CSSProperties = { padding: "4px 4px", fontSize: 11 };
