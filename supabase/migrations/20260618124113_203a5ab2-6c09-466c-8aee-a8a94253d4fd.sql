ALTER TABLE public.atacado_aparelhos
  ADD CONSTRAINT atacado_aparelhos_fornecedor_id_fkey
  FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);

NOTIFY pgrst, 'reload schema';