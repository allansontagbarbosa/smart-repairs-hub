
-- Restaurar catálogo de cores da empresa ARJ
DO $$
DECLARE
  v_empresa uuid := 'de4680d4-7f48-4971-bef4-8c5b64c09005';
  cor record;
BEGIN
  FOR cor IN
    SELECT * FROM (VALUES
      ('Preto',      '#000000'),
      ('Branco',     '#FFFFFF'),
      ('Azul',       '#2563EB'),
      ('Vermelho',   '#DC2626'),
      ('Verde',      '#16A34A'),
      ('Dourado',    '#D4AF37'),
      ('Prata',      '#C0C0C0'),
      ('Roxo',       '#7C3AED'),
      ('Cinza',      '#6B7280'),
      ('Meia-noite', '#1E1E2E'),
      ('Estelar',    '#E8E4D9')
    ) AS t(nome, hex)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.cores
      WHERE empresa_id = v_empresa AND lower(nome) = lower(cor.nome)
    ) THEN
      INSERT INTO public.cores (empresa_id, nome, hex, ativo)
      VALUES (v_empresa, cor.nome, cor.hex, true);
    END IF;
  END LOOP;
END $$;

-- Restaurar catálogo de capacidades da empresa ARJ
DO $$
DECLARE
  v_empresa uuid := 'de4680d4-7f48-4971-bef4-8c5b64c09005';
  cap record;
BEGIN
  -- Normaliza o registro existente "64" -> "64GB" com ordem correta
  UPDATE public.capacidades
     SET nome = '64GB', ordem = 64
   WHERE empresa_id = v_empresa AND trim(nome) = '64';

  FOR cap IN
    SELECT * FROM (VALUES
      ('32GB',   32),
      ('64GB',   64),
      ('128GB',  128),
      ('256GB',  256),
      ('512GB',  512),
      ('1TB',    1024)
    ) AS t(nome, ordem)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.capacidades
      WHERE empresa_id = v_empresa AND lower(nome) = lower(cap.nome)
    ) THEN
      INSERT INTO public.capacidades (empresa_id, nome, ordem, ativo)
      VALUES (v_empresa, cap.nome, cap.ordem, true);
    END IF;
  END LOOP;
END $$;
