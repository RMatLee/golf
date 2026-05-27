/**
 * Root client-side provider tree.
 * Wraps the entire application in `AuthProvider` so any component can call
 * `useAuth()` without needing to locate the provider manually.
 * Add additional context providers here if the app grows (e.g. theme, analytics).
 */
"use client";

import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
