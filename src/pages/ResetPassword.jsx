import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { CONFIG } from "../config";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase sends the user back with a session after clicking reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      setChecking(false);
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await updatePassword(password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to update password");
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Verifying link…</p>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Link expired
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This reset link has expired or is invalid.
          </p>
          <Link to="/forgot-password" className="btn-primary inline-block">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: CONFIG.primaryColour }}
          >
            {CONFIG.companyInitials}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {CONFIG.companyName}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Transport Management
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            Set new password
          </h1>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="label">Confirm new password</label>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
