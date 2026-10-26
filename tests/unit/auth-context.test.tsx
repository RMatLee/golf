import { act, render, screen, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const session: Session = {
  access_token: "test-token", refresh_token: "test-refresh",
  expires_in: 3600, token_type: "bearer",
  user: { id: "test-user", aud: "authenticated", created_at: "", app_metadata: {}, user_metadata: {} },
};
let notify: (event: AuthChangeEvent, session: Session | null) => void;

function Consumer() {
  const { session, loading, signOut } = useAuth();
  return (
    <>
      <p>{loading ? "Loading" : session ? "Signed in" : "Signed out"}</p>
      <button onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

beforeEach(() => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signOut.mockResolvedValue({ error: null });
  auth.onAuthStateChange.mockImplementation((callback: typeof notify) => {
    notify = callback;
    return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
  });
});

it("exposes the loading state until the initial session resolves", async () => {
  render(<AuthProvider><Consumer /></AuthProvider>);
  expect(screen.getByText("Loading")).toBeInTheDocument();
  expect(await screen.findByText("Signed out")).toBeInTheDocument();
});

it("loads an existing session, reacts to auth changes, and unsubscribes on unmount", async () => {
  auth.getSession.mockResolvedValue({ data: { session } });
  const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>);
  expect(await screen.findByText("Signed in")).toBeInTheDocument();
  act(() => notify("SIGNED_OUT", null));
  expect(screen.getByText("Signed out")).toBeInTheDocument();
  act(() => notify("SIGNED_IN", session));
  expect(screen.getByText("Signed in")).toBeInTheDocument();
  unmount();
  expect(auth.unsubscribe).toHaveBeenCalledOnce();
});

it("delegates sign-out to Supabase", async () => {
  render(<AuthProvider><Consumer /></AuthProvider>);
  await screen.findByText("Signed out");
  screen.getByRole("button", { name: "Sign out" }).click();
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
});

it("provides safe defaults outside a provider", async () => {
  render(<Consumer />);
  expect(screen.getByText("Loading")).toBeInTheDocument();
  await act(async () => screen.getByRole("button", { name: "Sign out" }).click());
  expect(auth.signOut).not.toHaveBeenCalled();
});
