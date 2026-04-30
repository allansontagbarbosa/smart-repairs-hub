DO $$
DECLARE
  v_peca_vidro_13 uuid := 'cc584f10-dbe1-4461-956c-5619986b8d53';
  v_compra_zumbi_1 uuid := '850a01d5-699e-46b9-a57a-93ff00fcf737';
  v_compra_zumbi_2 uuid := 'b636b015-f02d-44f8-b92f-d1299ba35fc1';
  v_movfin_zumbi_1 uuid := '17634ed7-2bb7-4361-b81e-2490a32fc722';
  v_movfin_zumbi_2 uuid := '77634730-e237-438e-94fb-afcffd996fed';
BEGIN
  DELETE FROM public.entradas_estoque_itens
   WHERE entrada_id IN (v_compra_zumbi_1, v_compra_zumbi_2);

  DELETE FROM public.entradas_estoque
   WHERE id IN (v_compra_zumbi_1, v_compra_zumbi_2);

  DELETE FROM public.movimentacoes_financeiras
   WHERE id IN (v_movfin_zumbi_1, v_movfin_zumbi_2);

  UPDATE public.estoque_itens
     SET custo_medio = 15.00,
         custo_unitario = 15.00,
         updated_at = now()
   WHERE id = v_peca_vidro_13;

  RAISE NOTICE 'Cleanup OK: 2 compras zumbi removidas (R$ 30 fake), VIDRO 13 ajustada para R$ 15,00';
END $$;