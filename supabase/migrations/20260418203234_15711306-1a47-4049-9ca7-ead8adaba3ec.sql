-- Permitir reaproveitar user_id após soft-delete de lojistas
DROP INDEX IF EXISTS idx_lojistas_user_id;
CREATE UNIQUE INDEX idx_lojistas_user_id ON public.lojistas(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

-- Liberar user_id do lojista deletado para o ativo poder usar
UPDATE public.lojistas SET user_id = NULL WHERE deleted_at IS NOT NULL AND user_id = '8a6fd1e0-903c-4e72-983a-4a6acb276706';

-- Ativar o lojista atual do Bruspy (vincular ao auth user que já criou senha)
UPDATE public.lojistas
SET status_acesso = 'ativo',
    user_id = '8a6fd1e0-903c-4e72-983a-4a6acb276706',
    convite_token = NULL,
    convite_aceito_em = COALESCE(convite_aceito_em, now())
WHERE id = 'a3e95155-f407-4e89-bd82-510bd419fcc9';