import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CONFIG } from "../config";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">✉️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We've sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the link.
          </p>
          <Link to="/" className="btn-primary inline-block mt-4">
            Back to sign in
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
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Reset password
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Enter your email and we'll send you a reset link.
          </p>
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
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          <Link
            to="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
