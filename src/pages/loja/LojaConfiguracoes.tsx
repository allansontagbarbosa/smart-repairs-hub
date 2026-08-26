import { useState } from "react";
import {
  Building2,
  Users as UsersIcon,
  CreditCard,
  Smartphone,
  FileText,
  Receipt,
  Printer,
  Tag,
  Download,
  Settings as Cog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfigEstoqueTab } from "@/components/configuracoes/ConfigEstoqueTab";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";

type Section =
  | "empresa"
  | "catalogo"
  | "usuarios"
  | "tef"
  | "pix"
  | "nfce"
  | "crediario"
  | "cupom"
  | "etiqueta"
  | "backup"
  | "geral";

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "catalogo", label: "Catálogo de aparelhos", icon: Smartphone },
  { id: "usuarios", label: "Usuários & Permissões", icon: UsersIcon },
  { id: "tef", label: "Integração TEF (cartão)", icon: CreditCard },
  { id: "pix", label: "Pix Dinâmico", icon: Smartphone },
  { id: "nfce", label: "NFC-e / NF-e", icon: FileText },
  { id: "crediario", label: "Crediário (juros/limites)", icon: Receipt },
  { id: "cupom", label: "Cupom impresso", icon: Printer },
  { id: "etiqueta", label: "Etiqueta aparelho", icon: Tag },
  { id: "backup", label: "Backup & Exportação", icon: Download },
  { id: "geral", label: "Geral", icon: Cog },
];

function SecaoCatalogo() {
  const { marcas, modelos, cores, capacidades } = useConfiguracoes();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Catálogo de aparelhos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Marcas, modelos, cores e capacidades usados nos campos de múltipla escolha do cadastro de aparelhos.
        </p>
      </div>
      <ConfigEstoqueTab marcas={marcas} modelos={modelos} cores={cores} capacidades={capacidades} />
    </div>
  );
}

export default function LojaConfiguracoes() {
  const [sec, setSec] = useState<Section>("empresa");

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configurações Loja</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Empresa, integrações, fiscal e personalização do varejo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <nav className="space-y-1 md:sticky md:top-4 self-start">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = sec === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSec(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {sec === "empresa" && <SecaoEmpresa />}
          {sec === "catalogo" && <SecaoCatalogo />}
          {sec === "usuarios" && <SecaoUsuarios />}
          {sec === "tef" && <SecaoTEF />}
          {sec === "pix" && <SecaoPix />}
          {sec === "nfce" && <SecaoNFCe />}
          {sec === "crediario" && <SecaoCrediario />}
          {sec === "cupom" && <SecaoCupom />}
          {sec === "etiqueta" && <SecaoEtiqueta />}
          {sec === "backup" && <SecaoBackup />}
          {sec === "geral" && <SecaoGeral />}
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SecaoEmpresa() {
  return (
    <SectionShell title="Empresa" desc="Dados que aparecem em notas e cupons da Loja.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Razão social"><Input placeholder="Empresa LTDA" /></Field>
        <Field label="Nome fantasia"><Input placeholder="Minha Loja" /></Field>
        <Field label="CNPJ"><Input placeholder="00.000.000/0001-00" /></Field>
        <Field label="Inscrição estadual"><Input placeholder="000.000.000.000" /></Field>
        <Field label="Endereço completo"><Input placeholder="Rua, número, bairro, cidade/UF" /></Field>
        <Field label="Telefone"><Input placeholder="(00) 00000-0000" /></Field>
        <Field label="E-mail"><Input type="email" placeholder="contato@loja.com" /></Field>
      </div>
      <div className="flex justify-end">
        <Button>Salvar</Button>
      </div>
    </SectionShell>
  );
}

function SecaoUsuarios() {
  return (
    <SectionShell
      title="Usuários & Permissões"
      desc="Reusa o sistema de Usuários & Permissões do Software."
    >
      <p className="text-sm text-muted-foreground">
        Permissões <code className="text-xs px-1 py-0.5 bg-muted rounded">loja_*</code> controlam
        o acesso a cada tela da Loja. Para gerenciar usuários e papéis, acesse{" "}
        <a className="text-primary underline" href="/configuracoes">
          Configurações → Usuários
        </a>{" "}
        do app principal.
      </p>
    </SectionShell>
  );
}

function SecaoTEF() {
  return (
    <SectionShell title="Integração TEF (Cartão)" desc="Configure a máquina de cartão para integrar com o PDV.">
      <Field label="Adquirente">
        <Select>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stone">Stone</SelectItem>
            <SelectItem value="cielo">Cielo</SelectItem>
            <SelectItem value="pagseguro">PagSeguro</SelectItem>
            <SelectItem value="sumup">SumUp</SelectItem>
            <SelectItem value="rede">Rede</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Chave de API"><Input type="password" placeholder="••••••••" /></Field>
        <Field label="ID do estabelecimento"><Input placeholder="EC123456" /></Field>
        <Field label="Taxa débito (%)"><Input type="number" step="0.01" placeholder="1.99" /></Field>
        <Field label="Taxa crédito à vista (%)"><Input type="number" step="0.01" placeholder="2.99" /></Field>
        <Field label="Taxa por parcela (%)"><Input type="number" step="0.01" placeholder="3.99" /></Field>
        <Field label="Prazo repasse (dias)"><Input type="number" placeholder="30" /></Field>
      </div>
      <div className="flex justify-end"><Button>Salvar TEF</Button></div>
    </SectionShell>
  );
}

function SecaoPix() {
  return (
    <SectionShell title="Pix Dinâmico" desc="Gere QR Code com valor exato e expiração.">
      <Field label="Banco">
        <Select>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="itau">Itaú</SelectItem>
            <SelectItem value="bradesco">Bradesco</SelectItem>
            <SelectItem value="santander">Santander</SelectItem>
            <SelectItem value="inter">Banco Inter</SelectItem>
            <SelectItem value="bb">Banco do Brasil</SelectItem>
            <SelectItem value="caixa">Caixa</SelectItem>
            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Chave Pix"><Input placeholder="cnpj@loja.com" /></Field>
        <Field label="Client ID (OAuth)"><Input placeholder="client_id" /></Field>
        <Field label="Client Secret"><Input type="password" placeholder="••••••••" /></Field>
        <Field label="Expiração do QR (min)"><Input type="number" placeholder="15" /></Field>
        <Field label="Webhook URL (confirmação)"><Input placeholder="https://..." /></Field>
      </div>
      <div className="flex justify-end"><Button>Salvar Pix</Button></div>
    </SectionShell>
  );
}

function SecaoNFCe() {
  return (
    <SectionShell title="NFC-e / NF-e" desc="Emissão fiscal — certificado A1, série e sequencial.">
      <Field label="Certificado A1 (.pfx)"><Input type="file" accept=".pfx" /></Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Senha do certificado"><Input type="password" placeholder="••••••••" /></Field>
        <Field label="Modelo">
          <Select>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nfce">NFC-e (loja)</SelectItem>
              <SelectItem value="nfe">NF-e (atacado)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Série"><Input placeholder="1" /></Field>
        <Field label="Sequencial atual"><Input type="number" placeholder="1" /></Field>
        <Field label="Ambiente">
          <Select>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="homo">Homologação</SelectItem>
              <SelectItem value="prod">Produção</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CSC"><Input placeholder="código de segurança" /></Field>
        <Field label="ID do CSC"><Input placeholder="000001" /></Field>
      </div>
      <div className="flex justify-end"><Button>Salvar fiscal</Button></div>
    </SectionShell>
  );
}

function SecaoCrediario() {
  return (
    <SectionShell title="Crediário (juros e limites)" desc="Taxa por faixa de parcelas, multa e juros de mora.">
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tabela de juros (% ao mês)
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="1x à vista"><Input type="number" step="0.01" placeholder="0" /></Field>
          <Field label="2-3x"><Input type="number" step="0.01" placeholder="2.5" /></Field>
          <Field label="4-6x"><Input type="number" step="0.01" placeholder="3.5" /></Field>
          <Field label="7-12x"><Input type="number" step="0.01" placeholder="4.5" /></Field>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Multa por atraso (%)"><Input type="number" step="0.01" placeholder="2" /></Field>
        <Field label="Juros de mora (% ao dia)"><Input type="number" step="0.01" placeholder="0.033" /></Field>
        <Field label="Limite default (Novo)"><Input type="number" placeholder="500" /></Field>
        <Field label="Limite default (Regular)"><Input type="number" placeholder="2000" /></Field>
        <Field label="Limite default (VIP)"><Input type="number" placeholder="10000" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="rounded" />
        Análise SPC/Serasa automática
      </label>
      <div className="flex justify-end"><Button>Salvar crediário</Button></div>
    </SectionShell>
  );
}

function SecaoCupom() {
  return (
    <Empty title="Cupom impresso" desc="Personalize cabeçalho, rodapé e logo do cupom térmico 80mm. Implementação na próxima fase." />
  );
}

function SecaoEtiqueta() {
  return (
    <Empty title="Etiqueta de aparelho" desc="Modelo da etiqueta de preço para aparelhos da vitrine (62×40mm). Implementação na próxima fase." />
  );
}

function SecaoBackup() {
  return (
    <Empty title="Backup & Exportação" desc="Exporte vendas, clientes, crediário e estoque em CSV/JSON. Implementação na próxima fase." />
  );
}

function SecaoGeral() {
  return (
    <Empty title="Geral" desc="Idioma, moeda, fuso horário e preferências regionais. Implementação na próxima fase." />
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <SectionShell title={title} desc={desc}>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">Em breve.</p>
      </div>
    </SectionShell>
  );
}
