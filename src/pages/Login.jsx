import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CONFIG } from "../config";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          {CONFIG.logoUrl ? (
            <img
              src={CONFIG.logoUrl}
              alt={CONFIG.companyName}
              className="h-10 object-contain"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: CONFIG.primaryColour }}
            >
              {CONFIG.companyInitials}
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {CONFIG.companyName}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Transport Management
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            Sign in
          </h1>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          Crown Cars Ltd · WSCC Supplier 103820
        </p>
      </div>
    </div>
  );
}
