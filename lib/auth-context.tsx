/**
 * Authentication context and provider.
 *
 * Wraps Supabase Auth to expose a React context with the current session.
 * `AuthProvider` subscribes to `onAuthStateChange` so all consumers re-render
 * automatically on sign-in, sign-out, or token refresh — no manual polling needed.
 *
 * Usage:
 *   const { session, loading, signOut } = useAuth();
 *   const isAdmin = session !== null;
 */
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => {},
});

/**
 * Provides auth state to the component tree.
 * Mount once at the root (`components/providers.tsx`).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signOut: () => supabase.auth.signOut().then() }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access the current auth session, loading state, and sign-out action. */
export function useAuth() {
  return useContext(AuthContext);
}
