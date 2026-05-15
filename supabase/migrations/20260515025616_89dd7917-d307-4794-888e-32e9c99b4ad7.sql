UPDATE public.clientes
SET status_convite = 'pendente',
    convite_aceito_em = NULL,
    user_id = NULL,
    convite_token = gen_random_uuid(),
    convite_enviado_em = NOW(),
    convite_expira_em = NOW() + INTERVAL '7 days',
    convite_email_enviado_em = NULL,
    updated_at = NOW()
WHERE id = 'a58f4e0c-afd0-48ea-bb8f-be358cf15995';