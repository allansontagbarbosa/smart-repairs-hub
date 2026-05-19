-- DAN-4: Fix Danilo user_profile mismatch + ban typo auth accounts

-- 1. Delete orphan profile (frees user_id 87989e40)
DELETE FROM public.user_profiles 
WHERE id = '10b609f2-3bb0-459d-bf21-236c03b3b219'
  AND user_id = '87989e40-d7d3-4076-9a85-906820b2866d';

-- 2. Delete ghost profile from typo (e4dce12a)
DELETE FROM public.user_profiles 
WHERE id = '7f27adcc-56af-45bb-a804-06ce0953b017'
  AND user_id = 'e4dce12a-0306-4330-afc5-156ac27e4bd2';

-- 3. Repoint active profile to real auth user
UPDATE public.user_profiles 
SET user_id = '87989e40-d7d3-4076-9a85-906820b2866d'
WHERE id = 'f424a2d4-0fda-4df0-a2a2-cfe962b1e4bd'
  AND user_id = 'f1cda3e0-de67-4a1f-a8fd-b2902a68d1ab'
  AND funcionario_id = 'a91f32e0-b077-443a-af4f-8aa61d0909c3';

-- 4. Ban the 2 ghost auth accounts (typos)
UPDATE auth.users 
SET banned_until = '2099-12-31'::timestamptz
WHERE id IN (
  'f1cda3e0-de67-4a1f-a8fd-b2902a68d1ab',
  'e4dce12a-0306-4330-afc5-156ac27e4bd2'
);