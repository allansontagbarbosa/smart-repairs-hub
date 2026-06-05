
-- 1) get_user_empresa_id: exclude lojista users
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.lojista_usuarios
      WHERE user_id = auth.uid() AND ativo = true
    ) THEN NULL::uuid
    ELSE (
      SELECT empresa_id
      FROM public.user_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND ativo = true
        AND empresa_id IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1
    )
  END;
$$;

-- 2) imei_device_cache: scope SELECT by empresa_id
DROP POLICY IF EXISTS imei_cache_select_authenticated ON public.imei_device_cache;
CREATE POLICY imei_cache_select_authenticated
  ON public.imei_device_cache
  FOR SELECT
  TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.get_my_empresa_id());

-- 3) loja_crediario_parcelas: explicit tenant_isolation
DROP POLICY IF EXISTS tenant_isolation ON public.loja_crediario_parcelas;
CREATE POLICY tenant_isolation
  ON public.loja_crediario_parcelas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loja_crediario c
    WHERE c.id = loja_crediario_parcelas.crediario_id
      AND c.empresa_id = public.get_my_empresa_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loja_crediario c
    WHERE c.id = loja_crediario_parcelas.crediario_id
      AND c.empresa_id = public.get_my_empresa_id()
  ));

-- 4) Restrict portal client UPDATE on ordens_de_servico via trigger
CREATE OR REPLACE FUNCTION public.restrict_portal_os_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_internal_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.lojista_usuarios WHERE user_id = auth.uid() AND ativo = true) THEN
    RETURN NEW;
  END IF;

  -- Portal client: enforce that only whitelisted columns may change
  IF NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.desconto IS DISTINCT FROM OLD.desconto
     OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
     OR NEW.valor_pago IS DISTINCT FROM OLD.valor_pago
     OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
     OR NEW.custo_pecas IS DISTINCT FROM OLD.custo_pecas
     OR NEW.custo_mao_de_obra IS DISTINCT FROM OLD.custo_mao_de_obra
     OR NEW.custo_total IS DISTINCT FROM OLD.custo_total
     OR NEW.lucro_bruto IS DISTINCT FROM OLD.lucro_bruto
     OR NEW.margem_calculada IS DISTINCT FROM OLD.margem_calculada
     OR NEW.tecnico_responsavel_id IS DISTINCT FROM OLD.tecnico_responsavel_id
     OR NEW.tecnico IS DISTINCT FROM OLD.tecnico
     OR NEW.funcionario_id IS DISTINCT FROM OLD.funcionario_id
     OR NEW.diagnostico IS DISTINCT FROM OLD.diagnostico
     OR NEW.servico_realizado IS DISTINCT FROM OLD.servico_realizado
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.aparelho_id IS DISTINCT FROM OLD.aparelho_id
     OR NEW.numero IS DISTINCT FROM OLD.numero
     OR NEW.numero_formatado IS DISTINCT FROM OLD.numero_formatado
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.lojista_id IS DISTINCT FROM OLD.lojista_id
     OR NEW.fatura_id IS DISTINCT FROM OLD.fatura_id
     OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
     OR NEW.tipo_servico_id IS DISTINCT FROM OLD.tipo_servico_id
     OR NEW.forma_pagamento_id IS DISTINCT FROM OLD.forma_pagamento_id
     OR NEW.forma_pagamento_sinal IS DISTINCT FROM OLD.forma_pagamento_sinal
     OR NEW.sinal_pago IS DISTINCT FROM OLD.sinal_pago
     OR NEW.garantia_dias IS DISTINCT FROM OLD.garantia_dias
     OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
     OR NEW.previsao_entrega IS DISTINCT FROM OLD.previsao_entrega
     OR NEW.data_entrega IS DISTINCT FROM OLD.data_entrega
     OR NEW.data_conclusao IS DISTINCT FROM OLD.data_conclusao
     OR NEW.cancelada_em IS DISTINCT FROM OLD.cancelada_em
     OR NEW.cancelada_por IS DISTINCT FROM OLD.cancelada_por
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.aprovado_no_ato IS DISTINCT FROM OLD.aprovado_no_ato
     OR NEW.retrabalho IS DISTINCT FROM OLD.retrabalho
     OR NEW.eh_retroativa IS DISTINCT FROM OLD.eh_retroativa
  THEN
    RAISE EXCEPTION 'Portal clients are not allowed to modify these fields on ordens_de_servico';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'aguardando_aprovacao'
       OR NEW.status NOT IN ('aprovado', 'recebido') THEN
      RAISE EXCEPTION 'Portal clients may only approve or reject a pending budget';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_portal_os_update ON public.ordens_de_servico;
CREATE TRIGGER trg_restrict_portal_os_update
  BEFORE UPDATE ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_portal_os_update();
