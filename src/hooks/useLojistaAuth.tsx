import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type LojistaUser = {
  id: string;
  lojista_id: string;
  nome: string;
  email: string;
  lojista?: {
    id: string;
    nome: string;
    razao_social: string | null;
    cnpj: string | null;
  };
};

export function useLojistaAuth() {
  const [lojistaUser, setLojistaUser] = useState<LojistaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;

      if (!session?.user) {
        setLojistaUser(null);
        setLoading(false);
        return;
      }

      const { data: rows } = await supabase
        .from('lojista_usuarios')
        .select('id, lojista_id, nome, email, ativo, lojistas:lojista_id(id, nome, razao_social, cnpj, ativo)')
        .eq('user_id', session.user.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cancelado) return;

      const data = (rows ?? [])[0];

      if (!data) {
        setLojistaUser(null);
        setLoading(false);
        return;
      }

      setLojistaUser({
        id: data.id,
        lojista_id: data.lojista_id,
        nome: data.nome,
        email: data.email,
        lojista: (data as any).lojistas ?? undefined,
      });
      setLoading(false);
    }

    carregar();

    return () => { cancelado = true; };
  }, []);

  async function lojistaSignOut() {
    await supabase.auth.signOut();
    setLojistaUser(null);
  }

  return { lojistaUser, loading, lojistaSignOut };
}

export function LojistaGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'bloqueado'>('verificando');

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;

      if (!session?.user) {
        setEstado('bloqueado');
        navigate('/lojista/login', { replace: true });
        return;
      }

      const { data: vinculos, error: vincErr } = await supabase
        .from('lojista_usuarios')
        .select('id, ativo')
        .eq('user_id', session.user.id)
        .eq('ativo', true)
        .limit(1);

      console.log('[LojistaGuard] user:', session.user.id, 'vinculos:', vinculos, 'err:', vincErr);

      if (cancelado) return;

      if (vincErr || !vinculos || vinculos.length === 0) {
        console.warn('[LojistaGuard] sem vínculo ativo, deslogando');
        await supabase.auth.signOut();
        setEstado('bloqueado');
        navigate('/lojista/login', { replace: true });
        return;
      }

      setEstado('ok');
    }

    verificar();

    return () => { cancelado = true; };
  }, []);

  if (estado === 'verificando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (estado === 'bloqueado') return null;

  return <>{children}</>;
}
