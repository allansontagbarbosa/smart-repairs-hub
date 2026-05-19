-- Consolidação Danilo: 6 funcionários → 1
-- #2 (a91f32e0) é canônico (474 comissões, 462 serviços, salário R$ 2.000)
-- Repointar user_profile do login atual para o #2, soft-deletar os 5 extras
-- (#1 já estava soft-deleted), corrigir email canônico e adicionar UNIQUE constraint

-- 1. Repointar user_profile do Danilo logado (#4 vazio → #2 canônico)
UPDATE public.user_profiles
   SET funcionario_id = 'a91f32e0-b077-443a-af4f-8aa61d0909c3'
 WHERE user_id = 'f1cda3e0-de67-4a1f-a8fd-b2902a68d1ab'
   AND funcionario_id = 'f289de15-1f7a-41cb-8883-bcce92850503';

-- 2. Soft-delete dos 4 funcionários extras ainda ativos (#1 já estava deleted)
UPDATE public.funcionarios
   SET ativo = false,
       deleted_at = NOW()
 WHERE id IN (
   '0b61e029-7eca-4bc2-9e8d-416cf8e75176', -- #3 typo
   'f289de15-1f7a-41cb-8883-bcce92850503', -- #4
   '26ec6ac1-b520-4e06-8825-a089478debbb', -- #5
   'cc874c9f-5faa-48ff-a597-9d7c64f6b087'  -- #6
 )
 AND deleted_at IS NULL;

-- 3. Corrigir email do #2 pro canônico (1 R, igual ao do Auth)
UPDATE public.funcionarios
   SET email = 'bdanilohenrique@gmail.com'
 WHERE id = 'a91f32e0-b077-443a-af4f-8aa61d0909c3';

-- 4. Desativar user_profiles fantasmas (órfão + vinculado ao #6)
UPDATE public.user_profiles
   SET ativo = false
 WHERE user_id IN (
   '87989e40-d7d3-4076-9a85-906820b2866d', -- órfão sem funcionario_id
   'e4dce12a-0306-4330-afc5-156ac27e4bd2'  -- estava vinculado ao #6
 )
 AND ativo = true;

-- 5. UNIQUE INDEX para impedir email duplicado em funcionários ativos
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_email_empresa_ativo
  ON public.funcionarios (empresa_id, lower(email))
  WHERE deleted_at IS NULL
    AND email IS NOT NULL
    AND email <> '';