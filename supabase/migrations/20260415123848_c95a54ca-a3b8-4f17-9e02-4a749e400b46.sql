-- Remove the problematic FOR ALL admin policy
DROP POLICY IF EXISTS "Admin manage empresa profiles" ON public.user_profiles;

-- Admin can READ profiles from same empresa
CREATE POLICY "Admin read empresa profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    empresa_id IS NOT NULL 
    AND empresa_id = get_my_empresa_id()
  );

-- Admin can UPDATE profiles from same empresa  
CREATE POLICY "Admin update empresa profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (
    is_admin_user(auth.uid()) 
    AND empresa_id IS NOT NULL 
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_admin_user(auth.uid()) 
    AND empresa_id IS NOT NULL 
    AND empresa_id = get_my_empresa_id()
  );