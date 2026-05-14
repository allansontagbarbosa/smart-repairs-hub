import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Phone, MapPin, FileText } from "lucide-react";
import {
  useAtualizarCliente,
  type DadosClienteEditaveis,
} from "@/hooks/useAtualizarCliente";

export interface ClienteEditavel {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  documento?: string | null;
  data_nascimento?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero_endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
}

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

type FormState = Required<{ [K in keyof DadosClienteEditaveis]: string }>;

const EMPTY: FormState = {
  nome: "", email: "", telefone: "", whatsapp: "", cpf: "", documento: "",
  data_nascimento: "", cep: "", rua: "", numero_endereco: "", complemento: "",
  bairro: "", cidade: "", estado: "", observacoes: "",
};

export function DadosClienteEditavel({ cliente }: { cliente: ClienteEditavel }) {
  const atualizar = useAtualizarCliente();
  const [f, setF] = useState<FormState>(EMPTY);

  useEffect(() => {
    setF({
      nome: cliente.nome ?? "",
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      whatsapp: cliente.whatsapp ?? "",
      cpf: cliente.cpf ?? "",
      documento: cliente.documento ?? "",
      data_nascimento: cliente.data_nascimento ?? "",
      cep: cliente.cep ?? "",
      rua: cliente.rua ?? "",
      numero_endereco: cliente.numero_endereco ?? "",
      complemento: cliente.complemento ?? "",
      bairro: cliente.bairro ?? "",
      cidade: cliente.cidade ?? "",
      estado: cliente.estado ?? "",
      observacoes: cliente.observacoes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  const setCampo = (k: keyof FormState) => (v: string) =>
    setF((s) => ({ ...s, [k]: v }));

  const houveMudanca = (Object.keys(f) as Array<keyof FormState>).some((k) => {
    const original = ((cliente as any)[k] ?? "") as string;
    return (f[k] ?? "") !== original;
  });

  function handleSalvar() {
    atualizar.mutate({ clienteId: cliente.id, dados: f });
  }

  async function buscarCep() {
    const cep = (f.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (data.erro) return;
      setF((s) => ({
        ...s,
        rua: data.logradouro || s.rua,
        bairro: data.bairro || s.bairro,
        cidade: data.localidade || s.cidade,
        estado: data.uf || s.estado,
      }));
    } catch {
      /* silencioso */
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Dados do cliente</h2>
      </div>

      <div className="space-y-5">
        <Bloco icon={User} titulo="Identificação">
          <Linha>
            <Campo label="Nome" valor={f.nome} onChange={setCampo("nome")} className="col-span-2" />
          </Linha>
          <Linha>
            <Campo label="CPF" valor={f.cpf} onChange={setCampo("cpf")} />
            <Campo label="Documento (RG/CNPJ)" valor={f.documento} onChange={setCampo("documento")} />
          </Linha>
          <Linha>
            <Campo label="Data de nascimento" type="date" valor={f.data_nascimento} onChange={setCampo("data_nascimento")} />
            <div />
          </Linha>
        </Bloco>

        <Bloco icon={Phone} titulo="Contato">
          <Linha>
            <Campo label="E-mail" type="email" valor={f.email} onChange={setCampo("email")} className="col-span-2" />
          </Linha>
          <Linha>
            <Campo label="Telefone" valor={f.telefone} onChange={setCampo("telefone")} />
            <Campo label="WhatsApp" valor={f.whatsapp} onChange={setCampo("whatsapp")} />
          </Linha>
        </Bloco>

        <Bloco icon={MapPin} titulo="Endereço">
          <Linha>
            <Campo label="CEP" valor={f.cep} onChange={setCampo("cep")} onBlur={buscarCep} />
            <div />
          </Linha>
          <Linha>
            <Campo label="Rua" valor={f.rua} onChange={setCampo("rua")} className="col-span-2" />
          </Linha>
          <Linha>
            <Campo label="Número" valor={f.numero_endereco} onChange={setCampo("numero_endereco")} />
            <Campo label="Complemento" valor={f.complemento} onChange={setCampo("complemento")} />
          </Linha>
          <Linha>
            <Campo label="Bairro" valor={f.bairro} onChange={setCampo("bairro")} />
            <Campo label="Cidade" valor={f.cidade} onChange={setCampo("cidade")} />
          </Linha>
          <Linha>
            <CampoSelect label="Estado" valor={f.estado} opcoes={ESTADOS} onChange={setCampo("estado")} />
            <div />
          </Linha>
        </Bloco>

        <Bloco icon={FileText} titulo="Observações internas">
          <Textarea
            value={f.observacoes}
            onChange={(e) => setCampo("observacoes")(e.target.value)}
            rows={3}
            placeholder="Notas internas sobre o cliente (não aparecem para ele)"
          />
        </Bloco>

        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button onClick={handleSalvar} disabled={!houveMudanca || atualizar.isPending} size="sm">
            {atualizar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Bloco({
  icon: Icon, titulo, children,
}: { icon: React.ComponentType<{ className?: string }>; titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        <Icon className="h-3 w-3" /> {titulo}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

interface CampoProps {
  label: string;
  valor?: string;
  type?: string;
  className?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}
function Campo({ label, valor, type = "text", className = "", onChange, onBlur }: CampoProps) {
  return (
    <div className={className}>
      <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
      <Input
        type={type}
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-9 text-sm"
      />
    </div>
  );
}

function CampoSelect({
  label, valor, opcoes, onChange,
}: { label: string; valor?: string; opcoes: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">—</option>
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
