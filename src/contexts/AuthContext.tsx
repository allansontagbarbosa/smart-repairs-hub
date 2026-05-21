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
  // Ref pra detectar mudança REAL de user. Evita setState quando só o token
  // foi renovado (TOKEN_REFRESHED ao voltar pra aba) — senão re-renderiza
  // a árvore inteira e desmonta modais com state local.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handlePostSignInRedirect = async (s: Session | null) => {
      if (!s?.user) return;
      const currentPath = window.location.pathname;
      if (!shouldAutoRedirectAfterSignIn(currentPath)) return;
      const nextPath = await resolvePostSignInPath(s.user.id);
      if (window.location.pathname !== nextPath) {
        window.location.replace(nextPath);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const newUserId = newSession?.user?.id ?? null;
      const userChanged = newUserId !== lastUserIdRef.current;

      // TOKEN_REFRESHED: dispara em background ao voltar pra aba. Se o user
      // é o mesmo, ignorar completamente — token é trocado no client do
      // Supabase de forma transparente, não precisa propagar pro React.
      if (event === "TOKEN_REFRESHED" && !userChanged) {
        return;
      }

      // INITIAL_SESSION quando já temos a session inicializada: no-op.
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

  // Memoizar o value pra evitar recriação a cada render do provider.
  // Só muda quando user.id ou access_token mudam de verdade.
  const value = useMemo<AuthContextType>(
    () => ({ user, session, loading, signOut }),
    [user?.id, session?.access_token, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
