-- Adicionar campos novos
ALTER TABLE tv_paineis
  ADD COLUMN IF NOT EXISTS layout jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS tamanho_fonte text DEFAULT 'M' CHECK (tamanho_fonte IN ('P', 'M', 'G'));

-- Migrar painéis existentes: criar layout default baseado em ordem dos widgets
UPDATE tv_paineis
SET layout = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'i', widget_id,
      'x', (idx % 3) * 4,
      'y', (idx / 3)::int * 2,
      'w', 4,
      'h', 2,
      'minW', 2,
      'minH', 1
    )
  )
  FROM (
    SELECT 
      value AS widget_id,
      ROW_NUMBER() OVER () - 1 AS idx
    FROM jsonb_array_elements_text(widgets)
  ) t
)
WHERE layout = '[]'::jsonb OR layout IS NULL;

-- RPC pra atualizar layout
CREATE OR REPLACE FUNCTION public.tv_atualizar_layout(
  p_painel_id uuid,
  p_layout jsonb,
  p_tamanho_fonte text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  UPDATE tv_paineis SET
    layout = p_layout,
    tamanho_fonte = COALESCE(p_tamanho_fonte, tamanho_fonte),
    logo_url = COALESCE(p_logo_url, logo_url),
    updated_at = now()
  WHERE id = p_painel_id AND empresa_id = v_empresa_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tv_atualizar_layout TO authenticated;

-- Bucket pra logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tv-logos', 'tv-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Empresa upload logos TV" ON storage.objects;
CREATE POLICY "Empresa upload logos TV"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tv-logos' AND
    (storage.foldername(name))[1] = (
      SELECT empresa_id::text FROM user_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Logos TV são públicas" ON storage.objects;
CREATE POLICY "Logos TV são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tv-logos');