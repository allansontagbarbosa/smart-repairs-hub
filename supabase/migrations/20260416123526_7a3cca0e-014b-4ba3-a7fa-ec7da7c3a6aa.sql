ALTER TABLE public.contas_a_pagar ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.recebimentos ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.comissoes ALTER COLUMN empresa_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF to_jsonb(NEW) ? 'updated_at' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', now()));
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.user_profiles
SET user_id = id
WHERE user_id IS NULL AND id IS NOT NULL;

UPDATE public.user_profiles
SET empresa_id = (
  SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1
)
WHERE empresa_id IS NULL AND ativo = true;

DO $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas ORDER BY criado_em ASC LIMIT 1;

  IF v_empresa_id IS NOT NULL THEN
    UPDATE public.contas_a_pagar SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.recebimentos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.comissoes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.socios SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.ajustes_mensais SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.funcionarios SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.ordens_de_servico SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.clientes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.aparelhos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id
  FROM public.user_profiles
  WHERE (user_id = auth.uid() OR id = auth.uid())
    AND ativo = true
    AND empresa_id IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.get_my_empresa_id();
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';