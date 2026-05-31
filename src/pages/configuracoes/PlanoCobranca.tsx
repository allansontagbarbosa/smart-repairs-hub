import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlanos, type PlanoComModulos } from "@/hooks/usePlanos";
import { usePlanoAtual } from "@/hooks/usePlanoAtual";
import { useEhAdmin } from "@/hooks/useEhAdmin";
import { Check, ArrowUp, ArrowDown, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const VERDE = "#00C896";
const MOD_NOME: Record<string, string> = {
  assistencia: "Assistência",
  loja: "Loja",
  atacado: "Atacado",
};
const MOD_LABEL_CONTAGEM: Record<string, string> = {
  os_abertas: "ordens de serviço abertas",
  aparelhos: "aparelhos em estoque",
  pedidos_abertos: "pedidos em aberto",
};

export default function PlanoCobranca() {
  const { data: ehDono = false } = useEhAdmin();
  const { planos, loading: loadingPlanos } = usePlanos();
  const { planoId, recarregar } = usePlanoAtual();
  const [alvo, setAlvo] = useState<PlanoComModulos | null>(null);
  const [removidos, setRemovidos] = useState<{ mod: string; info: any }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = planos.find((p) => p.id === planoId) ?? null;
  const ehDowngrade = !!(alvo && atual && atual.modulos.length > alvo.modulos.length);
  const ordenados = [...planos].sort((a, b) => a.preco_mensal - b.preco_mensal);

  async function abrirTroca(p: PlanoComModulos) {
    if (!ehDono || p.id === planoId) return;
    const modsRemovidos = (atual?.modulos ?? []).filter((m) => !p.modulos.includes(m));
    const infos = await Promise.all(
      modsRemovidos.map(async (mod) => {
        const { data } = await supabase.rpc("contar_dados_modulo" as any, { p_modulo: mod });
        return { mod, info: data };
      }),
    );
    setRemovidos(infos);
    setErro(null);
    setAlvo(p);
  }

  async function confirmar() {
    if (!alvo) return;
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("alterar_plano_empresa" as any, {
      p_plano_id: alvo.id,
    });
    if (error || !(data as any)?.success) {
      setErro((data as any)?.error ?? error?.message ?? "erro ao trocar de plano");
      setSalvando(false);
      return;
    }
    toast.success("Plano atualizado!");
    await recarregar();
    setAlvo(null);
    setSalvando(false);
    // recarrega rotas/guards (flags de módulo mudaram)
    setTimeout(() => window.location.reload(), 400);
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Plano e cobrança</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loadingPlanos
            ? "Carregando..."
            : atual
              ? `Seu plano atual é ${atual.nome} (R$ ${atual.preco_mensal.toFixed(0)}/mês).`
              : "Nenhum plano ativo encontrado."}
          {!ehDono && " Apenas o proprietário da conta pode alterar o plano."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ordenados.map((p) => {
          const atualCard = p.id === planoId;
          const upgrade = (atual?.modulos.length ?? 0) < p.modulos.length;
          return (
            <div
              key={p.id}
              className="border rounded-lg p-4 flex flex-col bg-card"
              style={atualCard ? { borderColor: VERDE, borderWidth: 2 } : {}}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">{p.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.modulos.map((m) => MOD_NOME[m] ?? m).join(" · ")}
                  </div>
                </div>
                {atualCard && (
                  <span
                    className="text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap"
                    style={{ background: "rgba(0,200,150,.15)", color: "#0F6E56" }}
                  >
                    Plano atual
                  </span>
                )}
              </div>
              <div className="mt-3 mb-3">
                <span className="text-2xl font-bold" style={{ color: VERDE }}>
                  R$ {p.preco_mensal.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              {ehDono && !atualCard && (
                <button
                  type="button"
                  onClick={() => abrirTroca(p)}
                  className="mt-auto border rounded-md py-2 text-sm flex items-center justify-center gap-1 hover:bg-muted/40 transition-colors"
                >
                  {upgrade ? (
                    <>
                      <ArrowUp className="w-4 h-4" /> Fazer upgrade
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4" /> Fazer downgrade
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog de confirmação */}
      {alvo && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-5 space-y-4">
            <h3 className="font-semibold text-lg">
              {ehDowngrade ? "Confirmar downgrade" : "Confirmar upgrade"} para {alvo.nome}?
            </h3>

            {ehDowngrade && removidos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Estes módulos serão ocultados:
                </div>
                <ul className="text-sm space-y-1 ml-6 list-disc">
                  {removidos.map((r) => (
                    <li key={r.mod}>
                      <strong>{MOD_NOME[r.mod] ?? r.mod}</strong>
                      {r.info &&
                        Object.entries(r.info).map(([k, v]) => (
                          <span key={k} className="text-muted-foreground">
                            {" "}
                            — {String(v)} {MOD_LABEL_CONTAGEM[k] ?? k.replace(/_/g, " ")}
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
                <div
                  className="flex items-start gap-2 text-xs rounded-md p-3 border"
                  style={{ background: "rgba(0,200,150,.08)", borderColor: VERDE }}
                >
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: VERDE }} />
                  <span>
                    Seus dados <strong>não serão apagados</strong>. Ficam guardados e voltam
                    intactos se você reativar o módulo.
                  </span>
                </div>
              </div>
            )}

            {!ehDowngrade && (
              <p className="text-sm text-muted-foreground">
                Os novos módulos serão liberados na hora. Nada do que você já tem é alterado.
              </p>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAlvo(null);
                  setErro(null);
                }}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={confirmar}
                className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                style={{ background: VERDE, color: "#04342C" }}
              >
                {salvando ? "Aplicando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
