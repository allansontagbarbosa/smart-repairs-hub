
-- 1) Adicionar valor 'cancelado' ao enum status_ordem
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'cancelado';

-- 2) Adicionar valor 'estornada' ao enum status_comissao
ALTER TYPE public.status_comissao ADD VALUE IF NOT EXISTS 'estornada';
