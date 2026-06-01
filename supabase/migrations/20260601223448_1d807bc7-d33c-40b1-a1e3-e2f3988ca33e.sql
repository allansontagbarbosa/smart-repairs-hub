-- 1) Inativar duplicatas que não estão em uso, mantendo a que tem mais usos (ou mais recente em empate)
WITH ranked AS (
  SELECT t.id, t.empresa_id, lower(t.nome) AS lnome,
         (SELECT COUNT(*) FROM public.assistencia_terceirizacoes z WHERE z.terceiro_id = t.id) AS usos,
         t.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY t.empresa_id, lower(t.nome)
           ORDER BY (SELECT COUNT(*) FROM public.assistencia_terceirizacoes z WHERE z.terceiro_id = t.id) DESC,
                    t.created_at DESC
         ) AS rn
  FROM public.assistencia_terceiros t
  WHERE t.ativo = true
)
UPDATE public.assistencia_terceiros SET ativo = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Índice único parcial (case-insensitive) por empresa em terceiros ativos
CREATE UNIQUE INDEX IF NOT EXISTS uq_terceiros_empresa_nome
  ON public.assistencia_terceiros (empresa_id, lower(nome))
  WHERE ativo = true;

-- 3) RPC idempotente de criação
CREATE OR REPLACE FUNCTION public.criar_terceiro(
  p_nome text, p_contato text, p_especialidade text, p_obs text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_id uuid;
  v_existe uuid;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;
  IF COALESCE(trim(p_nome),'') = '' THEN
    RETURN jsonb_build_object('success',false,'error','nome obrigatorio');
  END IF;

  SELECT id INTO v_existe FROM public.assistencia_terceiros
   WHERE empresa_id = v_emp AND lower(nome) = lower(trim(p_nome)) AND ativo = true
   LIMIT 1;

  IF v_existe IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'id',v_existe,'ja_existia',true);
  END IF;

  INSERT INTO public.assistencia_terceiros (empresa_id, nome, contato, especialidade, observacoes, ativo)
  VALUES (v_emp, trim(p_nome), NULLIF(trim(p_contato),''), NULLIF(trim(p_especialidade),''), NULLIF(trim(p_obs),''), true)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success',true,'id',v_id,'ja_existia',false);
END; $$;