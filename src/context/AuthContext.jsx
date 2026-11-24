import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Shown on top of the app when the session is lost mid-work.
// The app stays mounted underneath, so open forms are not lost.
function SessionExpiredOverlay({ email, onLogin, onLogout }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || "Sign in failed");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Session expired
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in again to carry on. Your open work is still here. Anything
            you saved while signed out may not have saved, so save it again.
          </p>
        </div>
        <input className="input" type="email" value={email || ""} disabled />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
          >
            Sign out instead
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [effectiveUserId, setEffectiveUserId] = useState(null); // owner's ID
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const resolvedForRef = useRef(null); // user id the workspace is resolved for
  const manualLogoutRef = useRef(false); // true while logout() is running

  // Resolve workspace: am I an owner or a member of someone else's workspace?
  // Returns true when resolved. On a failed lookup it keeps the previous
  // result — never falls back to the member's own id.
  const resolveWorkspace = async (authUser) => {
    if (!authUser) {
      resolvedForRef.current = null;
      setEffectiveUserId(null);
      setIsOwner(true);
      return true;
    }
    if (resolvedForRef.current === authUser.id) return true;

    // Check by email first (handles newly signed up members)
    const { data, error } = await supabase
      .from("workspace_members")
      .select("owner_user_id, id, member_user_id")
      .eq("member_email", authUser.email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("resolveWorkspace failed:", error);
      return false;
    }

    if (data?.owner_user_id && data.owner_user_id !== authUser.id) {
      // Update member_user_id to actual UUID on first login
      if (data.member_user_id !== authUser.id) {
        await supabase
          .from("workspace_members")
          .update({ member_user_id: authUser.id })
          .eq("id", data.id);
      }
      setEffectiveUserId(data.owner_user_id);
      setIsOwner(false);
    } else {
      setEffectiveUserId(authUser.id);
      setIsOwner(true);
    }
    resolvedForRef.current = authUser.id;
    return true;
  };

  useEffect(() => {
    let active = true;

    // Initial load — retry the workspace lookup up to 3 times
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!active) return;
      setUser(u);
      for (let i = 0; i < 3; i++) {
        if (await resolveWorkspace(u)) break;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
      if (active) setLoading(false);
    });

    // IMPORTANT: keep this callback synchronous. Awaiting a Supabase call
    // inside it deadlocks the auth lock. Defer DB work with setTimeout.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth]", event, new Date().toLocaleTimeString());
      const u = session?.user ?? null;

      if (event === "SIGNED_OUT") {
        if (manualLogoutRef.current) return; // logout() reloads the page
        // Session lost mid-work: keep the app mounted, ask to sign in again
        if (resolvedForRef.current) setSessionExpired(true);
        return;
      }
      if (!u) return;

      // A different person signed in: start clean
      if (resolvedForRef.current && resolvedForRef.current !== u.id) {
        window.location.replace("/");
        return;
      }

      setSessionExpired(false);
      if (event === "TOKEN_REFRESHED") return; // same user, nothing to resolve
      setUser((prev) => (prev?.id === u.id ? prev : u));
      setTimeout(() => resolveWorkspace(u), 0);
    });

    // When the tab becomes visible, check the user still exists.
    // Only a deleted user signs out — an expired token is refreshed by the client.
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || !resolvedForRef.current)
        return;
      const { error } = await supabase.auth.getUser();
      if (error && (error.code === "user_not_found" || error.status === 404)) {
        manualLogoutRef.current = true;
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/");
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signup = async (email, password, companyName) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // Store company name in user metadata
    if (companyName && data.user) {
      await supabase.auth.updateUser({ data: { company_name: companyName } });
    }
    return data;
  };

  const logout = async () => {
    manualLogoutRef.current = true;
    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      window.location.replace("/");
    }
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        effectiveUserId,
        isOwner,
        login,
        signup,
        logout,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
      {sessionExpired && (
        <SessionExpiredOverlay
          email={user?.email}
          onLogin={login}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
