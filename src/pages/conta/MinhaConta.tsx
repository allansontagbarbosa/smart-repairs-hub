import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PlanoCobranca from "@/pages/configuracoes/PlanoCobranca";
import { User, CreditCard } from "lucide-react";

const VERDE = "#00C896";

export default function MinhaConta() {
  const [aba, setAba] = useState<"dados" | "plano">("dados");

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Minha conta</h1>

      <div className="flex border-b">
        {([
          ["dados", "Dados pessoais", User],
          ["plano", "Plano e cobrança", CreditCard],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className="flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px"
            style={
              aba === id
                ? { borderColor: VERDE, color: "#0F6E56", fontWeight: 500 }
                : { borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {aba === "dados" && <AbaDadosPessoais />}
      {aba === "plano" && <PlanoCobranca />}
    </div>
  );
}

function AbaDadosPessoais() {
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "" });
  const [emailOrig, setEmailOrig] = useState("");
  const [senha, setSenha] = useState({ nova: "", confirma: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email ?? "";
      const uid = u?.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("nome_exibicao, funcionario_id, funcionarios:funcionario_id(telefone)")
        .eq("user_id", uid)
        .maybeSingle();
      setForm({
        nome: (prof as any)?.nome_exibicao ?? "",
        whatsapp: (prof as any)?.funcionarios?.telefone ?? "",
        email,
      });
      setEmailOrig(email);
    })();
  }, []);

  async function salvarPerfil() {
    setSalvando(true);
    setMsg(null);
    setErr(null);

    const { data, error } = await supabase.rpc("atualizar_meu_perfil" as any, {
      p_nome: form.nome,
      p_whatsapp: form.whatsapp,
    });
    if (error || !(data as any)?.success) {
      setErr((data as any)?.error ?? error?.message ?? "erro ao salvar perfil");
      setSalvando(false);
      return;
    }

    if (form.email && form.email !== emailOrig) {
      const { error: e2 } = await supabase.auth.updateUser({ email: form.email });
      if (e2) {
        setErr("Perfil salvo, mas o email falhou: " + e2.message);
        setSalvando(false);
        return;
      }
      setMsg("Perfil salvo. Confirme o novo email pela caixa de entrada para concluir a troca.");
      setSalvando(false);
      return;
    }

    setMsg("Dados atualizados.");
    setSalvando(false);
  }

  async function trocarSenha() {
    setMsg(null);
    setErr(null);
    if (senha.nova.length < 6) {
      setErr("A senha precisa de ao menos 6 caracteres.");
      return;
    }
    if (senha.nova !== senha.confirma) {
      setErr("As senhas não conferem.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: senha.nova });
    if (error) {
      setErr("Erro ao trocar a senha: " + error.message);
      return;
    }
    setSenha({ nova: "", confirma: "" });
    setMsg("Senha alterada.");
  }

  const inputCls =
    "w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#00C896]/30";

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div
          className="text-sm rounded-md p-3 border"
          style={{ background: "rgba(0,200,150,.08)", borderColor: VERDE, color: "#0F6E56" }}
        >
          {msg}
        </div>
      )}
      {err && (
        <div className="text-sm rounded-md p-3 border border-destructive/40 bg-destructive/10 text-destructive">
          {err}
        </div>
      )}

      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
          <input
            className={inputCls + " mt-1"}
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
            <input
              className={inputCls + " mt-1"}
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              className={inputCls + " mt-1"}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={salvarPerfil}
            className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ background: VERDE, color: "#04342C" }}
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>

      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <h3 className="font-semibold">Alterar senha</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
            <input
              type="password"
              className={inputCls + " mt-1"}
              value={senha.nova}
              onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
            <input
              type="password"
              className={inputCls + " mt-1"}
              value={senha.confirma}
              onChange={(e) => setSenha({ ...senha, confirma: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={trocarSenha}
            className="px-4 py-2 border rounded-md text-sm hover:bg-muted/40"
          >
            Trocar senha
          </button>
        </div>
      </div>
    </div>
  );
}
