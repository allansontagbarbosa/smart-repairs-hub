
-- 1. Trigger: auto-register status changes in historico_ordens
CREATE OR REPLACE FUNCTION public.registrar_historico_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.historico_ordens (ordem_id, status_anterior, status_novo, descricao)
    VALUES (NEW.id, OLD.status, NEW.status, 'Mudança automática de status');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historico_status
  AFTER UPDATE ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historico_status();

-- 2. Trigger: auto-generate commission when OS is marked as "pronto"
CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func record;
  v_valor_comissao numeric;
BEGIN
  -- Only when changing TO "pronto"
  IF NEW.status = 'pronto' AND OLD.status IS DISTINCT FROM 'pronto' AND NEW.funcionario_id IS NOT NULL THEN
    -- Get employee commission config
    SELECT tipo_comissao, valor_comissao INTO v_func
    FROM public.funcionarios
    WHERE id = NEW.funcionario_id AND ativo = true;

    IF FOUND AND v_func.valor_comissao > 0 THEN
      IF v_func.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_func.valor_comissao / 100;
      ELSE
        v_valor_comissao := v_func.valor_comissao;
      END IF;

      INSERT INTO public.comissoes (funcionario_id, ordem_id, valor, valor_base, tipo, status)
      VALUES (
        NEW.funcionario_id,
        NEW.id,
        v_valor_comissao,
        COALESCE(NEW.valor, 0),
        v_func.tipo_comissao::text,
        'pendente'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comissao_automatica
  AFTER UPDATE ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_comissao_automatica();

-- 3. WhatsApp message templates table
CREATE TABLE public.templates_mensagem (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.templates_mensagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.templates_mensagem
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default templates
INSERT INTO public.templates_mensagem (evento, titulo, mensagem) VALUES
  ('recebido', 'Aparelho Recebido', 'Olá {cliente}! Informamos que seu aparelho {aparelho} foi recebido com sucesso. OS #{numero}. Acompanhe pelo nosso portal.'),
  ('orcamento_pronto', 'Orçamento Pronto', 'Olá {cliente}! O orçamento do seu {aparelho} ficou em R$ {valor}. OS #{numero}. Por favor, entre em contato para aprovar.'),
  ('servico_concluido', 'Serviço Concluído', 'Olá {cliente}! O serviço no seu {aparelho} foi concluído com sucesso. OS #{numero}. Valor: R$ {valor}.'),
  ('pronto_retirada', 'Pronto para Retirada', 'Olá {cliente}! Seu {aparelho} está pronto para retirada. OS #{numero}. Aguardamos sua visita!');

-- 4. Apply updated_at trigger to templates_mensagem
CREATE TRIGGER update_templates_mensagem_updated_at
  BEFORE UPDATE ON public.templates_mensagem
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();
