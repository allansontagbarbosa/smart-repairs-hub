DROP POLICY IF EXISTS anon_validar_convite_token ON public.lojistas;

DROP POLICY IF EXISTS imei_cache_select_anon ON public.imei_device_cache;
DROP POLICY IF EXISTS imei_cache_write_authenticated ON public.imei_device_cache;
DROP POLICY IF EXISTS imei_cache_update_authenticated ON public.imei_device_cache;

CREATE OR REPLACE FUNCTION public.imei_device_cache_set_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.get_my_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imei_device_cache_set_empresa ON public.imei_device_cache;
CREATE TRIGGER trg_imei_device_cache_set_empresa
BEFORE INSERT ON public.imei_device_cache
FOR EACH ROW EXECUTE FUNCTION public.imei_device_cache_set_empresa();

CREATE POLICY imei_cache_insert_own_empresa
ON public.imei_device_cache
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IS NOT NULL
  AND empresa_id = public.get_my_empresa_id()
);

CREATE POLICY imei_cache_update_own_empresa
ON public.imei_device_cache
FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id())
WITH CHECK (empresa_id = public.get_my_empresa_id());