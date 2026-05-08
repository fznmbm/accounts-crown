import { createContext, useContext, useEffect, useState } from "react";
import { supabase, AUTH_STORAGE_KEY } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [effectiveUserId, setEffectiveUserId] = useState(null); // owner's ID
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);

  // Resolve workspace: am I an owner or a member of someone else's workspace?
  const resolveWorkspace = async (authUser) => {
    if (!authUser) {
      setEffectiveUserId(null);
      setIsOwner(true);
      return;
    }
    // Check by email first (handles newly signed up members)
    const { data } = await supabase
      .from("workspace_members")
      .select("owner_user_id, id")
      .eq("member_email", authUser.email.toLowerCase())
      .maybeSingle();

    if (data?.owner_user_id && data.owner_user_id !== authUser.id) {
      // Update member_user_id to actual UUID on first login
      await supabase
        .from("workspace_members")
        .update({ member_user_id: authUser.id })
        .eq("id", data.id);
      setEffectiveUserId(data.owner_user_id);
      setIsOwner(false);
    } else {
      setEffectiveUserId(authUser.id);
      setIsOwner(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      await resolveWorkspace(u);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await resolveWorkspace(u);
    });

    // Active session check every 30 seconds
    // Handles case where user is deleted server-side but onAuthStateChange doesn't fire

    // Only redirect if user WAS logged in and session was invalidated
    const sessionCheck = setInterval(() => {
      let token;
      try {
        token = JSON.parse(
          localStorage.getItem(AUTH_STORAGE_KEY),
        )?.access_token;
      } catch {
        return;
      }
      if (!token) return;
      // Verify token is still valid via direct REST call — bypasses GoTrue lock
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })
        .then((r) => {
          if (r.status === 401 || r.status === 403 || r.status === 404) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            window.location.replace("/");
          }
        })
        .catch(() => {});
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheck);
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

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.replace("/");
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
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
