
-- Create a function to ensure demo user is properly linked
-- This will be called after the demo user signs up/in
CREATE OR REPLACE FUNCTION public.ensure_demo_user(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_perfil_id uuid;
  v_func_id uuid;
BEGIN
  -- Get admin profile id
  SELECT id INTO v_admin_perfil_id FROM public.perfis_acesso WHERE nome_perfil = 'admin' LIMIT 1;
  
  -- Ensure funcionario exists
  SELECT id INTO v_func_id FROM public.funcionarios WHERE email = p_email AND deleted_at IS NULL LIMIT 1;
  
  IF v_func_id IS NULL THEN
    INSERT INTO public.funcionarios (nome, email, cargo, funcao, ativo)
    VALUES ('Usuário Demo', p_email, 'admin', 'Administrador', true)
    RETURNING id INTO v_func_id;
  END IF;

  -- Ensure user_profiles links to perfil admin and funcionario
  INSERT INTO public.user_profiles (user_id, nome_exibicao, perfil_id, funcionario_id, ativo)
  VALUES (p_user_id, 'Usuário Demo', v_admin_perfil_id, v_func_id, true)
  ON CONFLICT (user_id) DO UPDATE SET
    perfil_id = COALESCE(EXCLUDED.perfil_id, user_profiles.perfil_id),
    funcionario_id = COALESCE(EXCLUDED.funcionario_id, user_profiles.funcionario_id),
    nome_exibicao = COALESCE(EXCLUDED.nome_exibicao, user_profiles.nome_exibicao),
    ativo = true;
END;
$$;

-- Add unique constraint on user_profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
