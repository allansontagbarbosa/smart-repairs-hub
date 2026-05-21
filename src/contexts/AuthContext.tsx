import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AUTH_REDIRECT_ROUTES = new Set(["/", "/login", "/cadastro"]);

const shouldAutoRedirectAfterSignIn = (pathname: string) => AUTH_REDIRECT_ROUTES.has(pathname);

const resolvePostSignInPath = async (userId: string) => {
  const { data: lojistaCheck } = await supabase
    .from("lojista_usuarios")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (lojistaCheck) {
    return "/lojista";
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("empresa_id")
    .or(buildUserProfileLookup(userId))
    .maybeSingle();

  if (error) {
    console.error("Auth redirect error:", error);
    return "/onboarding";
  }

  return data?.empresa_id ? "/dashboard" : "/onboarding";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Ref pra evitar setState quando só o token muda (mesma identidade de user).
  // Isso previne cascata de re-renders que desmonta modais ao voltar pra aba.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handlePostSignInRedirect = async (session: Session | null) => {
      if (!session?.user) return;

      const currentPath = window.location.pathname;
      if (!shouldAutoRedirectAfterSignIn(currentPath)) return;

      const nextPath = await resolvePostSignInPath(session.user.id);
      if (window.location.pathname !== nextPath) {
        window.location.replace(nextPath);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const newUserId = newSession?.user?.id ?? null;
      const userChanged = newUserId !== lastUserIdRef.current;

      // TOKEN_REFRESHED dispara quando a aba volta de hidden→visible.
      // Se o user é o mesmo, NÃO mexer no state — senão re-renderiza
      // toda a árvore e desmonta modais com state local.
      if (event === "TOKEN_REFRESHED" && !userChanged) {
        return;
      }

      // Para INITIAL_SESSION, só atualizar state se for a primeira vez
      // ou se o user mudou (login em outra conta numa segunda aba).
      if (event === "INITIAL_SESSION" && !userChanged && lastUserIdRef.current !== null) {
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN") {
        if (userChanged && lastUserIdRef.current !== null) {
          void queryClient.invalidateQueries();
        }
        void handlePostSignInRedirect(newSession);
      }

      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }

      lastUserIdRef.current = newUserId;
    });

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setUser(initial?.user ?? null);
      lastUserIdRef.current = initial?.user?.id ?? null;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Memoizar o value do context — só recria quando user.id muda de verdade.
  // Sem isso, todo render do AuthProvider re-renderiza toda a árvore.
  const value = useMemo<AuthContextType>(
    () => ({ user, session, loading, signOut }),
    [user?.id, session?.access_token, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AUTH_REDIRECT_ROUTES = new Set(["/", "/login", "/cadastro"]);

const shouldAutoRedirectAfterSignIn = (pathname: string) => AUTH_REDIRECT_ROUTES.has(pathname);

const resolvePostSignInPath = async (userId: string) => {
  // Verificar se é lojista — nunca redirecionar para /dashboard
  const { data: lojistaCheck } = await supabase
    .from("lojista_usuarios")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (lojistaCheck) {
    return "/lojista";
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("empresa_id")
    .or(buildUserProfileLookup(userId))
    .maybeSingle();

  if (error) {
    console.error("Auth redirect error:", error);
    return "/onboarding";
  }

  return data?.empresa_id ? "/dashboard" : "/onboarding";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handlePostSignInRedirect = async (session: Session | null) => {
      if (!session?.user) return;

      const currentPath = window.location.pathname;
      if (!shouldAutoRedirectAfterSignIn(currentPath)) return;

      const nextPath = await resolvePostSignInPath(session.user.id);
      if (window.location.pathname !== nextPath) {
        window.location.replace(nextPath);
      }
    };

    let previousUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== previousUserId;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // NÃO invalidar queries em TOKEN_REFRESHED — esse evento dispara ao voltar
      // pra aba do navegador (auto-refresh do Supabase) e estava fechando modais
      // por causa da cascata de re-renders. O token é trocado de forma transparente.

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // Só invalidar se o usuário realmente mudou (login de outra conta)
        if (userChanged && previousUserId !== null) {
          void queryClient.invalidateQueries();
        }
        if (event === "SIGNED_IN") {
          void handlePostSignInRedirect(session);
        }
      }

      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }

      previousUserId = newUserId;
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
