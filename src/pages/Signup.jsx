import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CONFIG } from "../config";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const [isMember, setIsMember] = useState(false);

  const checkIfMember = async (email) => {
    if (!email || !email.includes("@")) return;
    const { data } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("member_email", email.toLowerCase())
      .maybeSingle();
    setIsMember(!!data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.companyName.trim())
      return setError("Please enter your company name.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      await signup(form.email, form.password, form.companyName);
      setDone(true);
    } catch (err) {
      setError(err.message || "Signup failed");
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
            We've sent a confirmation link to <strong>{form.email}</strong>.
            Click the link to activate your account then sign in.
          </p>
          <Link to="/" className="btn-primary inline-block mt-4">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
            Create your account
          </h1>
          <form onSubmit={submit} className="space-y-4">
            {!isMember && (
              <div className="space-y-1">
                <label className="label">Company name</label>
                <input
                  className="input"
                  value={form.companyName}
                  onChange={f("companyName")}
                  placeholder="e.g. XYZ Transport Ltd"
                />
              </div>
            )}
            {isMember && (
              <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                ✓ You've been invited to join a team. Complete signup to access
                the system.
              </div>
            )}
            <div className="space-y-1">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={f("email")}
                onBlur={(e) => checkIfMember(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={f("password")}
                placeholder="Minimum 8 characters"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={f("confirm")}
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          Already have an account?{" "}
          <Link
            to="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
