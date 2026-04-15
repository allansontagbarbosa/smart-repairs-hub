import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN") {
        void handlePostSignInRedirect(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
