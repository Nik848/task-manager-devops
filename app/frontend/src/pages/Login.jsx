import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillAdmin = () => {
    setEmail("admin@example.com");
    setPassword("changeme");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-warm-50 py-12 px-4 sm:px-6 lg:px-8 selection:bg-coral-100 selection:text-coral-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center space-x-2.5 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white font-bold text-lg shadow-sm border border-navy-800 transition-transform group-hover:scale-105">
            <span className="text-coral-500 font-extrabold text-xl">T</span>M
          </div>
          <span className="text-2xl font-bold tracking-tight text-navy-950">
            TaskManager
          </span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-navy-600">
          Sign in to access your projects, tasks, and system metrics.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-warm-md border border-warm-200">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-coral-50 border border-coral-200 text-coral-800 text-xs font-medium leading-relaxed">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 placeholder-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 placeholder-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-coral-500 hover:bg-coral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coral-400 shadow-coral hover:shadow-warm-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in to account"}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-6 pt-5 border-t border-warm-200 text-center">
            <span className="text-xs text-navy-500 block mb-2 font-medium">
              Demo admin credentials:
            </span>
            <button
              type="button"
              onClick={fillAdmin}
              className="inline-flex items-center space-x-1.5 text-xs text-coral-600 hover:text-coral-700 font-semibold bg-coral-50 px-3 py-1.5 rounded-lg border border-coral-200/80 transition-colors"
            >
              <span>Auto-fill Admin (admin@example.com)</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-navy-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-coral-600 hover:text-coral-700 transition-colors"
          >
            Create one free
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-warm-500">
          <Link to="/" className="hover:text-navy-800 transition-colors">
            ← Back to Landing Page
          </Link>
        </p>
      </div>
    </div>
  );
}
