
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  referencia_id UUID,
  referencia_tabela TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access notificacoes"
  ON public.notificacoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Trigger: notify on status changes (aguardando_aprovacao, aprovado, recusado)
CREATE OR REPLACE FUNCTION public.notificar_mudanca_status_os()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aguardando_aprovacao' AND OLD.status IS DISTINCT FROM 'aguardando_aprovacao' THEN
    INSERT INTO public.notificacoes (tipo, titulo, mensagem, referencia_id, referencia_tabela)
    VALUES ('os_aguardando_aprovacao',
            'OS #' || NEW.numero || ' aguardando aprovação',
            'Cliente precisa aprovar o orçamento',
            NEW.id, 'ordens_de_servico');
  END IF;

  IF NEW.status = 'aprovado' AND OLD.status = 'aguardando_aprovacao' THEN
    INSERT INTO public.notificacoes (tipo, titulo, mensagem, referencia_id, referencia_tabela)
    VALUES ('os_aprovada',
            'OS #' || NEW.numero || ' aprovada!',
            'Cliente aprovou o orçamento pelo portal',
            NEW.id, 'ordens_de_servico');
  END IF;

  IF NEW.status = 'recebido' AND OLD.status = 'aguardando_aprovacao' THEN
    INSERT INTO public.notificacoes (tipo, titulo, mensagem, referencia_id, referencia_tabela)
    VALUES ('os_recusada',
            'OS #' || NEW.numero || ' recusada',
            'Cliente recusou o orçamento',
            NEW.id, 'ordens_de_servico');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_mudanca_status
  AFTER UPDATE ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mudanca_status_os();
