import { usePlanos } from "@/hooks/usePlanos";

// ⚠️ Estimativas de mercado — ajustáveis. Usadas só como comparativo informativo.
const STACK_AVULSA = [
  { nome: "Sistema de OS / assistência", preco: 119 },
  { nome: "PDV / frente de caixa (loja)", preco: 99 },
  { nome: "ERP atacado / pedidos B2B", preco: 149 },
  { nome: "Financeiro / fluxo de caixa", preco: 59 },
  { nome: "CRM / cadastro de clientes", preco: 49 },
  { nome: "Comissões e metas", preco: 39 },
  { nome: "Disparo de WhatsApp", preco: 89 },
  { nome: "Painéis / BI", preco: 79 },
  { nome: "Catálogo B2B online", preco: 79 },
];

export function EconomiaCombo({ selMods }: { selMods: string[] }) {
  const { planoPorModulos, planoPorSlugModulo } = usePlanos();
  const plano = planoPorModulos(selMods);
  if (!plano) return null;

  const isCombo = selMods.length === 3;
  const soloSum = (["assistencia", "loja", "atacado"] as const)
    .map((m) => planoPorSlugModulo(m)?.preco_mensal ?? 0)
    .reduce((a, b) => a + b, 0);
  const economiaMes = soloSum - plano.preco_mensal;
  const stackTotal = STACK_AVULSA.reduce((a, b) => a + b.preco, 0);

  return (
    <div className="mt-5 border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Plano recomendado
          </div>
          <div className="text-lg font-semibold">{plano.nome}</div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold" style={{ color: "#00C896" }}>
            R$ {plano.preco_mensal.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">/mês</span>
        </div>
      </div>

      {isCombo && economiaMes > 0 && (
        <div
          className="text-sm rounded-md p-3 border"
          style={{ background: "rgba(0,200,150,.08)", borderColor: "#00C896" }}
        >
          Comprando os 3 módulos separados seriam{" "}
          <span className="line-through">R$ {soloSum.toFixed(0)}</span>. Com o Combo você
          economiza{" "}
          <strong style={{ color: "#0F6E56" }}>R$ {economiaMes.toFixed(0)}/mês</strong>{" "}
          (R$ {(economiaMes * 12).toFixed(0)}/ano).
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        Montar a mesma operação com ferramentas avulsas de mercado custaria cerca de{" "}
        <strong>R$ {stackTotal}/mês</strong> — e sem integração. O Ditt entrega tudo num
        login só.
      </p>
    </div>
  );
}
