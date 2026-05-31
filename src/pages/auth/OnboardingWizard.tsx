import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlanos } from "@/hooks/usePlanos";
import { EconomiaCombo } from "@/components/onboarding/EconomiaCombo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DittLogo } from "@/components/DittLogo";
import { Wrench, Store, Building2, Check, ArrowLeft, ArrowRight } from "lucide-react";

type Mod = "assistencia" | "loja" | "atacado";
const MOD_INFO: Record<Mod, { icon: any; nome: string; desc: string; tipoLabel: string }> = {
  assistencia: { icon: Wrench, nome: "Assistência", desc: "OS, técnicos, fluxo de reparo", tipoLabel: "Assist. técnica" },
  loja: { icon: Store, nome: "Loja", desc: "PDV, vendas varejo, trade-in", tipoLabel: "Loja / varejo" },
  atacado: { icon: Building2, nome: "Atacado", desc: "Pedidos B2B, tabelas de preço", tipoLabel: "Atacado" },
};
const EMP_OPCOES = ["Só eu", "2–5", "6–10", "11–20", "20+"];
const VERDE = "#00C896";

export default function OnboardingWizard() {
  const nav = useNavigate();
  const { planoPorModulos } = usePlanos();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "", email: "", whatsapp: "", senha: "",
    empresa: "", cnpj: "", cidade: "", uf: "",
    tipos: {} as Record<Mod, boolean>,
    mods: {} as Record<Mod, boolean>,
    qtdFunc: "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const selMods = (Object.keys(MOD_INFO) as Mod[]).filter((m) => form.mods[m]);
  const selTipos = (Object.keys(MOD_INFO) as Mod[]).filter((m) => form.tipos[m]);
  const plano = planoPorModulos(selMods);

  const toggleTipo = (m: Mod) =>
    setForm((f) => {
      const novo = !f.tipos[m];
      return {
        ...f,
        tipos: { ...f.tipos, [m]: novo },
        mods: { ...f.mods, [m]: novo },
      };
    });
  const toggleMod = (m: Mod) =>
    setForm((f) => ({ ...f, mods: { ...f.mods, [m]: !f.mods[m] } }));

  const podeAvancar = () => {
    if (step === 0) return !!(form.nome && form.email && form.senha && form.senha.length >= 6);
    if (step === 1) return !!(form.empresa && selTipos.length > 0 && form.qtdFunc);
    if (step === 2) return selMods.length > 0;
    return true;
  };

  async function finalizar() {
    setSaving(true); setErro(null);
    const { error: e1 } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { nome: form.nome, whatsapp: form.whatsapp },
      },
    });
    if (e1) { setErro(e1.message); setSaving(false); return; }

    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session) {
      const { data, error: e2 } = await supabase.rpc("onboarding_criar_empresa" as any, {
        p_payload: {
          nome: form.empresa, cnpj: form.cnpj, cidade: form.cidade, uf: form.uf,
          tipo_organizacao: selTipos, modulos: selMods, qtd_funcionarios: form.qtdFunc,
        },
      });
      if (e2 || !(data as any)?.success) {
        setErro((data as any)?.error ?? e2?.message ?? "erro ao criar empresa");
        setSaving(false); return;
      }
      window.location.href = "/dashboard";
    } else {
      try {
        localStorage.setItem("onboarding_pendente", JSON.stringify({
          nome: form.empresa, cnpj: form.cnpj, cidade: form.cidade, uf: form.uf,
          tipo_organizacao: selTipos, modulos: selMods, qtd_funcionarios: form.qtdFunc,
        }));
      } catch {}
      nav("/login?verifique=1");
    }
    setSaving(false);
  }

  const passos = ["Conta", "Empresa", "Plano", "Pronto"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border rounded-xl shadow-sm p-6 md:p-8">
        <div className="flex justify-center mb-6">
          <DittLogo className="h-10" />
        </div>

        {/* progresso */}
        <div className="flex items-center justify-between mb-6">
          {passos.map((p, i) => (
            <div key={p} className="flex-1 flex items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                style={
                  i <= step
                    ? { background: VERDE, color: "#04342C" }
                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="ml-2 text-xs hidden md:inline text-muted-foreground">{p}</span>
              {i < passos.length - 1 && (
                <div className="flex-1 h-px mx-2" style={{ background: i < step ? VERDE : "hsl(var(--border))" }} />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Crie sua conta</h2>
            <div className="space-y-2">
              <Label>Seu nome</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha (mín. 6)</Label>
                <Input type="password" value={form.senha} onChange={(e) => set("senha", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Sobre sua empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ (opcional)</Label>
                <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de organização — pode marcar mais de um</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {(Object.keys(MOD_INFO) as Mod[]).map((m) => {
                  const I = MOD_INFO[m].icon;
                  const on = form.tipos[m];
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => toggleTipo(m)}
                      className="relative border rounded-md p-3 text-sm text-left flex items-center gap-2 transition-colors"
                      style={on ? { borderColor: VERDE, borderWidth: 2, background: "rgba(0,200,150,.1)" } : {}}
                    >
                      <I className="w-4 h-4" style={on ? { color: VERDE } : {}} />
                      {MOD_INFO[m].tipoLabel}
                      {on && <Check className="w-4 h-4 ml-auto" style={{ color: VERDE }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quantidade de funcionários</Label>
              <div className="grid grid-cols-5 gap-2">
                {EMP_OPCOES.map((o) => (
                  <button
                    type="button"
                    key={o}
                    onClick={() => set("qtdFunc", o)}
                    className="border rounded-md py-2 text-xs transition-colors"
                    style={
                      form.qtdFunc === o
                        ? { borderColor: VERDE, borderWidth: 2, background: "rgba(0,200,150,.1)", color: "#0F6E56" }
                        : {}
                    }
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Confirme seus módulos</h2>
            <p className="text-sm text-muted-foreground">
              Pré-marcamos pelo tipo da sua empresa. Ajuste se quiser — o plano recalcula sozinho.
            </p>
            <div className="space-y-2">
              {(Object.keys(MOD_INFO) as Mod[]).map((m) => {
                const I = MOD_INFO[m].icon;
                const on = form.mods[m];
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleMod(m)}
                    className="relative w-full border rounded-md p-3 flex items-center gap-3 text-left transition-colors"
                    style={on ? { borderColor: VERDE, borderWidth: 2, background: "rgba(0,200,150,.1)" } : {}}
                  >
                    <I className="w-5 h-5" style={on ? { color: VERDE } : {}} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{MOD_INFO[m].nome}</div>
                      <div className="text-xs text-muted-foreground">{MOD_INFO[m].desc}</div>
                    </div>
                    {on && <Check className="w-5 h-5" style={{ color: VERDE }} />}
                  </button>
                );
              })}
            </div>
            <EconomiaCombo selMods={selMods} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Tudo pronto</h2>
            <div className="border rounded-md divide-y">
              <Row k="Nome" v={form.nome} />
              <Row k="Email" v={form.email} />
              <Row k="Empresa" v={form.empresa} />
              <Row k="Cidade/UF" v={[form.cidade, form.uf].filter(Boolean).join(" / ") || "—"} />
              <Row k="Tipos" v={selTipos.map((m) => MOD_INFO[m].nome).join(" · ") || "—"} />
              <Row k="Funcionários" v={form.qtdFunc || "—"} />
              <Row k="Módulos" v={selMods.map((m) => MOD_INFO[m].nome).join(" · ") || "—"} />
              <Row k="Plano" v={plano ? `${plano.nome} — R$ ${plano.preco_mensal.toFixed(0)}/mês` : "—"} hl />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={finalizar}
              className="w-full py-3 rounded-md font-medium disabled:opacity-50"
              style={{ background: VERDE, color: "#04342C" }}
            >
              {saving ? "Criando..." : "Criar conta e começar"}
            </button>
          </div>
        )}

        {/* navegação */}
        {step < 3 && (
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-4 py-2 border rounded-md text-sm flex items-center gap-1"
              style={{ visibility: step === 0 ? "hidden" : "visible" }}
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              type="button"
              disabled={!podeAvancar()}
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2 rounded-md text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              style={{ background: VERDE, color: "#04342C" }}
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="underline" style={{ color: VERDE }}>
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className="flex justify-between items-center p-3 text-sm" style={hl ? { background: "rgba(0,200,150,.06)" } : {}}>
      <span className="text-muted-foreground">{k}</span>
      <span className={hl ? "font-semibold" : "font-medium"}>{v}</span>
    </div>
  );
}
