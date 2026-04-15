-- Drop all existing policies on user_profiles to clean up
DROP POLICY IF EXISTS "Admin manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "User own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated insert profile" ON public.user_profiles;

-- SELECT: users can read their own profile
CREATE POLICY "Users read own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: system can create profiles (trigger on auth.users)
CREATE POLICY "System insert profile"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: users can update their own profile
CREATE POLICY "Users update own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can manage all profiles in same empresa (using SECURITY DEFINER function, no recursion)
CREATE POLICY "Admin manage empresa profiles"
  ON public.user_profiles FOR ALL TO authenticated
  USING (
    is_admin_user(auth.uid()) 
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_admin_user(auth.uid()) 
    AND empresa_id = get_my_empresa_id()
  );