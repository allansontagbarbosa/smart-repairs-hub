ALTER TABLE public.produtos_base DROP CONSTRAINT IF EXISTS produtos_base_marca_id_fkey;
ALTER TABLE public.produtos_base ADD CONSTRAINT produtos_base_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES public.marcas(id) ON DELETE SET NULL;

ALTER TABLE public.produtos_base DROP CONSTRAINT IF EXISTS produtos_base_categoria_id_fkey;
ALTER TABLE public.produtos_base ADD CONSTRAINT produtos_base_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.estoque_categorias(id) ON DELETE SET NULL;