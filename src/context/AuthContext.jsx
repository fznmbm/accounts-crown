import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

    return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setUser(null);
    setEffectiveUserId(null);
    setIsOwner(true);
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
