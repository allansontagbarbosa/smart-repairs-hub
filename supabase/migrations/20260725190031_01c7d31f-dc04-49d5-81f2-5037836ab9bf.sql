-- Remove self-service profile creation: profiles are only created server-side
-- (invite-user edge function using the service role). This eliminates any
-- possibility of a user self-assigning an empresa_id on INSERT.
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;

-- Extra hard guard: never allow a profile to be created/attached to the
-- lojista sentinel empresa id.
CREATE OR REPLACE FUNCTION public.user_profiles_block_sentinel_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'empresa_id inválido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_block_sentinel_empresa ON public.user_profiles;
CREATE TRIGGER user_profiles_block_sentinel_empresa
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.user_profiles_block_sentinel_empresa();