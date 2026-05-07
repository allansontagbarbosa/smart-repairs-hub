CREATE SCHEMA IF NOT EXISTS admin;

CREATE TYPE admin.role_staff AS ENUM ('owner', 'suporte', 'vendas', 'financeiro');
CREATE TYPE admin.tier_plano AS ENUM ('starter', 'pro', 'enterprise');
CREATE TYPE admin.status_assinatura AS ENUM ('trial', 'ativa', 'inadimplente', 'cancelada', 'pausada');
CREATE TYPE admin.tipo_evento_billing AS ENUM ('trial_iniciado', 'trial_terminou', 'assinatura_criada', 'fatura_paga', 'fatura_falhou', 'plano_alterado', 'cancelada');
CREATE TYPE admin.status_ticket AS ENUM ('aberto', 'em_andamento', 'aguardando_cliente', 'fechado');

CREATE TABLE admin.usuarios_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  role admin.role_staff NOT NULL DEFAULT 'suporte',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier admin.tier_plano NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco_mensal_centavos int NOT NULL,
  stripe_price_id text,
  limite_oss_mes int,
  limite_tecnicos int,
  limite_lojas int,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_id uuid REFERENCES admin.planos(id),
  status admin.status_assinatura NOT NULL DEFAULT 'trial',
  trial_iniciado_em timestamptz NOT NULL DEFAULT now(),
  trial_termina_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ativada_em timestamptz,
  cancelada_em timestamptz,
  motivo_cancelamento text,
  stripe_customer_id text,
  stripe_subscription_id text,
  proximo_ciclo_em timestamptz,
  mrr_centavos int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assinaturas_empresa ON admin.assinaturas(empresa_id);
CREATE INDEX idx_assinaturas_status ON admin.assinaturas(status);
CREATE INDEX idx_assinaturas_trial ON admin.assinaturas(trial_termina_em) WHERE status = 'trial';

CREATE TABLE admin.eventos_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES admin.assinaturas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  tipo admin.tipo_evento_billing NOT NULL,
  valor_centavos int,
  payload jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_billing_assinatura ON admin.eventos_billing(assinatura_id, criado_em DESC);
CREATE INDEX idx_eventos_billing_empresa ON admin.eventos_billing(empresa_id, criado_em DESC);

CREATE TABLE admin.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  empresa_id uuid NOT NULL,
  aberto_por_user_id uuid REFERENCES auth.users(id),
  atribuido_a uuid REFERENCES admin.usuarios_internos(id),
  assunto text NOT NULL,
  descricao text,
  status admin.status_ticket NOT NULL DEFAULT 'aberto',
  criado_em timestamptz NOT NULL DEFAULT now(),
  fechado_em timestamptz,
  ultima_resposta_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_empresa ON admin.tickets(empresa_id, criado_em DESC);
CREATE INDEX idx_tickets_status ON admin.tickets(status, criado_em DESC);

CREATE TABLE admin.notas_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  autor_id uuid NOT NULL REFERENCES admin.usuarios_internos(id),
  texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notas_empresa ON admin.notas_cliente(empresa_id, criado_em DESC);

CREATE TABLE admin.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES admin.usuarios_internos(id),
  acao text NOT NULL,
  empresa_id uuid,
  detalhes jsonb,
  ip text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_staff ON admin.audit_log(staff_id, criado_em DESC);
CREATE INDEX idx_audit_log_empresa ON admin.audit_log(empresa_id, criado_em DESC);

CREATE OR REPLACE FUNCTION admin.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = admin, public AS $$
  SELECT EXISTS (SELECT 1 FROM admin.usuarios_internos WHERE user_id = auth.uid() AND ativo = true);
$$;

GRANT EXECUTE ON FUNCTION admin.is_staff() TO authenticated;