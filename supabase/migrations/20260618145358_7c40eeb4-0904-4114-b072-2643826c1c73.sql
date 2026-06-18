
-- 1) Consolidar referências da Apple antiga para a APPLE canônica
UPDATE public.modelos       SET marca_id = '3c877e8a-f80d-40b4-9db5-af90f83e9e5c' WHERE marca_id = 'b5fd9131-c1c2-452a-bb30-b886d57a378a';
UPDATE public.produtos_base SET marca_id = '3c877e8a-f80d-40b4-9db5-af90f83e9e5c' WHERE marca_id = 'b5fd9131-c1c2-452a-bb30-b886d57a378a';
UPDATE public.estoque_itens SET marca_id = '3c877e8a-f80d-40b4-9db5-af90f83e9e5c' WHERE marca_id = 'b5fd9131-c1c2-452a-bb30-b886d57a378a';
UPDATE public.aparelhos     SET marca_id = '3c877e8a-f80d-40b4-9db5-af90f83e9e5c' WHERE marca_id = 'b5fd9131-c1c2-452a-bb30-b886d57a378a';

-- 2) Remover marcas lixo (Apple duplicada e "A" sem uso)
DELETE FROM public.marcas WHERE id = 'b5fd9131-c1c2-452a-bb30-b886d57a378a';
DELETE FROM public.marcas WHERE id = '1cf7e8b6-825f-451f-8e65-21614da4e3d4'
  AND NOT EXISTS (SELECT 1 FROM public.modelos       WHERE marca_id = '1cf7e8b6-825f-451f-8e65-21614da4e3d4')
  AND NOT EXISTS (SELECT 1 FROM public.produtos_base WHERE marca_id = '1cf7e8b6-825f-451f-8e65-21614da4e3d4')
  AND NOT EXISTS (SELECT 1 FROM public.estoque_itens WHERE marca_id = '1cf7e8b6-825f-451f-8e65-21614da4e3d4')
  AND NOT EXISTS (SELECT 1 FROM public.aparelhos     WHERE marca_id = '1cf7e8b6-825f-451f-8e65-21614da4e3d4');

-- 3) Trocar FK de modelos.marca_id de CASCADE para RESTRICT
ALTER TABLE public.modelos DROP CONSTRAINT IF EXISTS modelos_marca_id_fkey;
ALTER TABLE public.modelos
  ADD CONSTRAINT modelos_marca_id_fkey
  FOREIGN KEY (marca_id) REFERENCES public.marcas(id) ON DELETE RESTRICT;
