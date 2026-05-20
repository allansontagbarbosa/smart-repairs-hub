
CREATE TABLE IF NOT EXISTS public.etiqueta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('os_entrada', 'os_retirada', 'peca_estoque', 'cliente_aparelho', 'custom')),

  largura_mm numeric NOT NULL DEFAULT 50,
  altura_mm numeric NOT NULL DEFAULT 30,
  margem_topo_mm numeric DEFAULT 2,
  margem_lateral_mm numeric DEFAULT 2,
  orientacao text DEFAULT 'retrato' CHECK (orientacao IN ('retrato', 'paisagem')),

  tipo_impressora text DEFAULT 'termica' CHECK (tipo_impressora IN ('termica', 'a4_multipla')),
  etiquetas_por_linha int DEFAULT 1,
  etiquetas_por_coluna int DEFAULT 1,
  espacamento_horizontal_mm numeric DEFAULT 2,
  espacamento_vertical_mm numeric DEFAULT 2,

  fonte_familia text DEFAULT 'Arial' CHECK (fonte_familia IN ('Arial','Helvetica','Courier','Verdana','Times')),
  fonte_tamanho_base int DEFAULT 10,
  fonte_tamanho_titulo int DEFAULT 12,
  fonte_tamanho_pequeno int DEFAULT 8,

  campos_visiveis jsonb DEFAULT '["logo","nome_empresa","os_numero","cliente_nome","aparelho","data_entrada","qr_code"]'::jsonb,
  campos_config jsonb DEFAULT '[]'::jsonb,

  mostrar_qr_code boolean DEFAULT false,
  qr_code_conteudo text DEFAULT 'os_numero',
  qr_code_url_base text,
  qr_code_tamanho_mm numeric DEFAULT 15,
  qr_code_posicao text DEFAULT 'direita' CHECK (qr_code_posicao IN ('esquerda','direita','centro_topo','centro_baixo')),

  mostrar_codigo_barras boolean DEFAULT false,
  codigo_barras_conteudo text DEFAULT 'os_numero',
  codigo_barras_altura_mm numeric DEFAULT 8,

  mostrar_logo boolean DEFAULT true,
  logo_posicao text DEFAULT 'topo_centro' CHECK (logo_posicao IN ('topo_esquerda','topo_centro','topo_direita')),
  logo_altura_mm numeric DEFAULT 8,

  texto_rodape text,
  mostrar_data_impressao boolean DEFAULT false,

  ativo boolean DEFAULT true,
  e_padrao boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_templates_empresa ON public.etiqueta_templates(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etiqueta_templates_tipo ON public.etiqueta_templates(empresa_id, tipo) WHERE deleted_at IS NULL AND ativo = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_etiqueta_template_padrao
  ON public.etiqueta_templates(empresa_id, tipo)
  WHERE e_padrao = true AND deleted_at IS NULL;

ALTER TABLE public.etiqueta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem etiquetas da sua empresa"
ON public.etiqueta_templates FOR SELECT
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Usuários inserem etiquetas da sua empresa"
ON public.etiqueta_templates FOR INSERT
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Usuários atualizam etiquetas da sua empresa"
ON public.etiqueta_templates FOR UPDATE
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Usuários removem etiquetas da sua empresa"
ON public.etiqueta_templates FOR DELETE
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_etiqueta_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_etiqueta_templates_updated_at
BEFORE UPDATE ON public.etiqueta_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_etiqueta_templates_updated_at();

INSERT INTO public.etiqueta_templates (empresa_id, nome, tipo, e_padrao, ativo)
SELECT id, 'Etiqueta de Entrada Padrão', 'os_entrada', true, true
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.etiqueta_templates t
  WHERE t.empresa_id = e.id AND t.tipo = 'os_entrada' AND t.e_padrao = true AND t.deleted_at IS NULL
);

INSERT INTO public.etiqueta_templates (
  empresa_id, nome, tipo, e_padrao, ativo,
  largura_mm, altura_mm, fonte_tamanho_base, fonte_tamanho_titulo, fonte_tamanho_pequeno,
  campos_visiveis, mostrar_codigo_barras, codigo_barras_conteudo, mostrar_logo, logo_altura_mm
)
SELECT id, 'Etiqueta de Peça Padrão', 'peca_estoque', true, true,
  50, 25, 9, 11, 7,
  '["nome_peca","sku","codigo_barras","preco"]'::jsonb,
  true, 'sku', false, 6
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.etiqueta_templates t
  WHERE t.empresa_id = e.id AND t.tipo = 'peca_estoque' AND t.e_padrao = true AND t.deleted_at IS NULL
);
