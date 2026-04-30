DO $$
DECLARE
  v_aparelhos_zumbi uuid[] := ARRAY[
    '9f90f19e-193d-4a19-85e0-faf6eca98221',
    '85c62c4c-d0e6-4c44-a1cd-0a2885cc90f1',
    '33276d4d-be4e-411c-9445-079ae68c4f52',
    '39c9049c-5145-40a7-a795-84f65fe47889',
    'a4d96ee8-611e-4f26-a280-c6b7368efc79',
    'dee10734-d638-4007-9c23-f2c7320eaf8b',
    '8d5e4e1c-2ce9-4e24-bf61-d44d7e00751e',
    '5dc8f262-e68e-4488-9d02-c4053e147607',
    'c1146665-4063-4351-9511-9a2634efb12f'
  ]::uuid[];
  v_os_zumbi uuid[] := ARRAY[
    '839208a4-171f-4f83-a649-7d7cad3c6c85',
    '23a29e2a-3605-44d3-afe1-105f139062de',
    'ce4a25a5-195a-4f59-bb8f-0eed7cb444ed',
    '4a01eb45-b746-4f18-be74-8f4bdfa5c04a',
    '4d2f2988-e293-4ed4-8d9c-645d865bbabf',
    '26b7f9d8-5d30-480c-bcd7-1d2b2613f2d2',
    '9637d948-2422-448a-aed6-dead8649dad3',
    '039240a2-1aef-44b2-ac66-cb8c198da82c',
    '69517ba6-0d50-405f-aa9c-0ff6bda55040'
  ]::uuid[];
  v_aparelhos_dup_7857 uuid[] := ARRAY[
    '332ab4e1-4589-4de9-9dfb-58966707134f',
    'a69307ad-ac64-497f-a0f6-0a25003e4ac2',
    '080d0e75-1544-4fa0-a7e9-13a88e812357'
  ]::uuid[];
  v_peca_vidro_13 uuid := 'cc584f10-dbe1-4461-956c-5619986b8d53';
BEGIN
  UPDATE public.estoque_itens
     SET quantidade = quantidade + 1, updated_at = now()
   WHERE id = v_peca_vidro_13;

  DELETE FROM public.pecas_utilizadas WHERE ordem_id = ANY(v_os_zumbi);
  DELETE FROM public.os_servicos WHERE ordem_id = ANY(v_os_zumbi);
  DELETE FROM public.os_auditoria WHERE ordem_id = ANY(v_os_zumbi);
  DELETE FROM public.ordens_de_servico WHERE id = ANY(v_os_zumbi);
  DELETE FROM public.aparelhos WHERE id = ANY(v_aparelhos_zumbi);

  DELETE FROM public.aparelhos WHERE id = ANY(v_aparelhos_dup_7857);

  RAISE NOTICE 'Cleanup OK';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_aparelhos_imei_unique
  ON public.aparelhos (empresa_id, imei)
  WHERE imei IS NOT NULL AND imei <> '';