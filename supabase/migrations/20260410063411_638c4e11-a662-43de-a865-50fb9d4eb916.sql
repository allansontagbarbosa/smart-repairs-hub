
-- Table for per-service commissions
CREATE TABLE public.comissoes_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_servico_id uuid NOT NULL REFERENCES public.tipos_servico(id) ON DELETE CASCADE,
  tipo_comissao public.tipo_comissao NOT NULL DEFAULT 'fixa',
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, tipo_servico_id)
);

ALTER TABLE public.comissoes_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access" ON public.comissoes_servico FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.comissoes_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_comissoes_servico_updated_at
  BEFORE UPDATE ON public.comissoes_servico
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Update the auto-commission trigger to check per-service first
CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_cs record;
  v_func record;
  v_valor_comissao numeric;
  v_tipo text;
BEGIN
  IF NEW.status = 'pronto' AND OLD.status IS DISTINCT FROM 'pronto' AND NEW.funcionario_id IS NOT NULL THEN
    -- 1) Try per-service commission
    IF NEW.tipo_servico_id IS NOT NULL THEN
      SELECT tipo_comissao, valor INTO v_cs
      FROM public.comissoes_servico
      WHERE funcionario_id = NEW.funcionario_id
        AND tipo_servico_id = NEW.tipo_servico_id;
    END IF;

    IF v_cs IS NOT NULL AND v_cs.valor > 0 THEN
      IF v_cs.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_cs.valor / 100;
      ELSE
        v_valor_comissao := v_cs.valor;
      END IF;
      v_tipo := v_cs.tipo_comissao::text;
    ELSE
      -- 2) Fallback to default employee commission
      SELECT tipo_comissao, valor_comissao INTO v_func
      FROM public.funcionarios
      WHERE id = NEW.funcionario_id AND ativo = true;

      IF NOT FOUND OR v_func.valor_comissao <= 0 THEN
        RETURN NEW;
      END IF;

      IF v_func.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_func.valor_comissao / 100;
      ELSE
        v_valor_comissao := v_func.valor_comissao;
      END IF;
      v_tipo := v_func.tipo_comissao::text;
    END IF;

    INSERT INTO public.comissoes (funcionario_id, ordem_id, valor, valor_base, tipo, status)
    VALUES (
      NEW.funcionario_id,
      NEW.id,
      v_valor_comissao,
      COALESCE(NEW.valor, 0),
      v_tipo,
      'pendente'
    );
  END IF;
  RETURN NEW;
END;
$$;
