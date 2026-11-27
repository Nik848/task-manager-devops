import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-warm-50 text-navy-900 flex flex-col justify-between selection:bg-coral-100 selection:text-coral-800">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="border-b border-warm-200/80 bg-warm-50/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white font-bold text-lg shadow-warm transition-transform group-hover:scale-105 border border-navy-800">
              <span className="text-coral-500 font-extrabold text-xl">T</span>M
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-navy-950">
                TaskManager
              </span>
              <span className="text-[10px] uppercase tracking-wider text-warm-500 font-semibold -mt-1">
                Warm Minimalism
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-navy-700">
            <a href="#features" className="hover:text-coral-600 transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-coral-600 transition-colors">
              Workflow
            </a>
            <a href="#telemetry" className="hover:text-coral-600 transition-colors">
              Telemetry
            </a>
            <a href="#architecture" className="hover:text-coral-600 transition-colors">
              Architecture
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold hover:bg-navy-800 transition-all shadow-warm hover:shadow-warm-md"
              >
                <span>Go to Dashboard</span>
                <span className="text-coral-400">→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-950 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="px-5 py-2.5 rounded-xl bg-coral-500 text-white text-sm font-semibold hover:bg-coral-600 transition-all shadow-coral hover:shadow-warm-md transform hover:-translate-y-0.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Subtle Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-coral-200/30 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-navy-200/20 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-coral-50 border border-coral-200/70 text-coral-700 text-xs font-semibold mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-coral-500 animate-pulse" />
            <span>DevOps Capstone • Production-Grade Web Application</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-navy-950 max-w-4xl mx-auto leading-[1.12]">
            Workflows designed with{" "}
            <span className="text-coral-500 underline decoration-coral-300 decoration-wavy decoration-2 underline-offset-8">
              purpose
            </span>{" "}
            & clarity.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-navy-600 max-w-2xl mx-auto font-normal leading-relaxed">
            A cloud-native task management ecosystem engineered with Node.js, Express,
            Drizzle ORM, and Supabase. Experience warm minimalism with unmatched speed and observability.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-coral-500 text-white font-semibold text-base hover:bg-coral-600 transition-all shadow-coral hover:shadow-warm-lg transform hover:-translate-y-0.5"
              >
                Open Dashboard (Signed in as {user.name})
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-coral-500 text-white font-semibold text-base hover:bg-coral-600 transition-all shadow-coral hover:shadow-warm-lg transform hover:-translate-y-0.5"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-navy-800 font-semibold text-base border border-warm-300 hover:border-navy-400 hover:bg-warm-100 transition-all shadow-warm"
                >
                  Sign in with Demo Account
                </Link>
              </>
            )}
          </div>

          {/* Metric Highlights Pill */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-sm text-navy-600 font-medium">
            <div className="flex items-center space-x-2">
              <span className="text-coral-500 font-bold">✓</span>
              <span>Supabase Postgres DB</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-coral-500 font-bold">✓</span>
              <span>JWT & Role-Based Auth</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-coral-500 font-bold">✓</span>
              <span>Prometheus & Loki Ready</span>
            </div>
          </div>

          {/* Interactive UI Showcase Mockup */}
          <div className="mt-16 max-w-5xl mx-auto rounded-2xl bg-white p-3 sm:p-4 shadow-warm-lg border border-warm-200/90 text-left">
            <div className="bg-navy-950 rounded-xl p-4 sm:p-6 text-white shadow-inner">
              <div className="flex items-center justify-between pb-4 border-b border-navy-800">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-coral-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/80 inline-block" />
                  <span className="text-xs font-mono text-navy-300 ml-3">
                    taskmanager.internal/dashboard
                  </span>
                </div>
                <div className="text-xs bg-navy-800/80 text-coral-300 px-3 py-1 rounded-full border border-navy-700">
                  Live Preview
                </div>
              </div>

              {/* Mock Dashboard Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-navy-900 p-4 rounded-lg border border-navy-800">
                  <span className="text-xs text-navy-400 block font-medium">Total Tasks</span>
                  <span className="text-2xl font-bold text-white mt-1 block">24</span>
                  <span className="text-[11px] text-emerald-400 mt-2 block">↑ 12% this week</span>
                </div>
                <div className="bg-navy-900 p-4 rounded-lg border border-navy-800">
                  <span className="text-xs text-navy-400 block font-medium">In Progress</span>
                  <span className="text-2xl font-bold text-coral-400 mt-1 block">8</span>
                  <span className="text-[11px] text-navy-300 mt-2 block">Assigned across team</span>
                </div>
                <div className="bg-navy-900 p-4 rounded-lg border border-navy-800">
                  <span className="text-xs text-navy-400 block font-medium">Completed</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-1 block">14</span>
                  <span className="text-[11px] text-navy-300 mt-2 block">Passed automated review</span>
                </div>
                <div className="bg-navy-900 p-4 rounded-lg border border-navy-800">
                  <span className="text-xs text-navy-400 block font-medium">System Health</span>
                  <span className="text-2xl font-bold text-coral-400 mt-1 block">100%</span>
                  <span className="text-[11px] text-emerald-400 mt-2 block">DB connected & healthy</span>
                </div>
              </div>

              {/* Mock Task List Rows */}
              <div className="mt-6 space-y-2.5">
                <div className="bg-navy-900/70 p-3.5 rounded-lg border border-navy-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-500" />
                    <span className="text-sm font-medium text-white">
                      Deploy Loki centralized log collection daemonset
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-coral-500/20 text-coral-300 px-2.5 py-0.5 rounded-md border border-coral-500/30">
                      High Priority
                    </span>
                    <span className="text-xs bg-navy-800 text-navy-300 px-2 py-0.5 rounded">
                      In Progress
                    </span>
                  </div>
                </div>

                <div className="bg-navy-900/70 p-3.5 rounded-lg border border-navy-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-sm font-medium text-white">
                      Implement Admin user status & RBAC guardrails
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                      Done
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ─────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-warm-100/60 border-y border-warm-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-coral-600 mb-2">
              Capabilities
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-navy-950">
              Built for engineering speed and operational resilience
            </p>
            <p className="mt-4 text-base text-navy-600">
              Everything needed to orchestrate team initiatives, maintain audit trails, and monitor application health.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-warm border border-warm-200 hover:shadow-warm-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-coral-100 text-coral-600 flex items-center justify-center text-xl font-bold mb-6">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">
                Agile Task Lifecycle
              </h3>
              <p className="text-sm text-navy-600 leading-relaxed">
                Organize projects with status tracking (To Do, In Progress, Done), customizable priorities (Low, Medium, High), due dates, and assignee delegation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-warm border border-warm-200 hover:shadow-warm-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-navy-100 text-navy-800 flex items-center justify-center text-xl font-bold mb-6">
                🛡️
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">
                Role Governance & Security
              </h3>
              <p className="text-sm text-navy-600 leading-relaxed">
                Granular Admin vs User roles. Admin dashboard empowers team leads to manage members, toggle active statuses, and prevent lockouts with protective guardrails.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-warm border border-warm-200 hover:shadow-warm-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-coral-100 text-coral-600 flex items-center justify-center text-xl font-bold mb-6">
                📊
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">
                Built-in Observability
              </h3>
              <p className="text-sm text-navy-600 leading-relaxed">
                First-class metrics instrumentation with Prometheus `/metrics`, structured Pino JSON logging, and dedicated Grafana Loki dashboard views.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow Steps ───────────────────────────────────────────────── */}
      <section id="workflow" className="py-20 bg-warm-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-coral-600 mb-2">
              Workflow
            </h2>
            <p className="text-3xl font-extrabold text-navy-950">
              Three simple steps to mastery
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="w-10 h-10 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center mx-auto mb-4 border border-navy-800">
                1
              </div>
              <h4 className="text-lg font-bold text-navy-900 mb-2">Create & Assign</h4>
              <p className="text-sm text-navy-600">
                Log in and register tasks with detailed descriptions, target deadlines, and assignees.
              </p>
            </div>

            <div className="p-6">
              <div className="w-10 h-10 rounded-full bg-coral-500 text-white font-bold flex items-center justify-center mx-auto mb-4 shadow-coral">
                2
              </div>
              <h4 className="text-lg font-bold text-navy-900 mb-2">Collaborate in Real-Time</h4>
              <p className="text-sm text-navy-600">
                Update status badges, adjust priorities on the fly, and filter by your assigned workload.
              </p>
            </div>

            <div className="p-6">
              <div className="w-10 h-10 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center mx-auto mb-4 border border-navy-800">
                3
              </div>
              <h4 className="text-lg font-bold text-navy-900 mb-2">Analyze & Optimize</h4>
              <p className="text-sm text-navy-600">
                Inspect completion rates and operational overhead on the visual dashboard overview.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture & DevOps Banner ─────────────────────────────────── */}
      <section id="architecture" className="py-16 bg-navy-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="max-w-xl">
              <span className="text-xs uppercase font-bold tracking-widest text-coral-400">
                DevOps Capstone Foundation
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
                Architected for high reliability across the entire pipeline
              </h2>
              <p className="mt-4 text-navy-300 text-sm leading-relaxed">
                Built with Docker multi-stage non-root containers, Kubernetes manifests,
                GitOps integration, automated tests, and Supabase cloud Postgres pooling.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-mono">
                <span className="bg-navy-900 border border-navy-800 px-3 py-1 rounded-md text-coral-300">
                  Express v4
                </span>
                <span className="bg-navy-900 border border-navy-800 px-3 py-1 rounded-md text-navy-200">
                  React 18 + Vite
                </span>
                <span className="bg-navy-900 border border-navy-800 px-3 py-1 rounded-md text-navy-200">
                  Drizzle ORM
                </span>
                <span className="bg-navy-900 border border-navy-800 px-3 py-1 rounded-md text-coral-300">
                  Supabase Pooler
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="px-8 py-3.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold text-center transition-all shadow-coral"
              >
                Create Account
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-navy-900 hover:bg-navy-850 text-white border border-navy-700 font-semibold text-center transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-warm-200 bg-warm-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-navy-500 gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-navy-700">TaskManager System Online</span>
            <span>•</span>
            <span>Sem 4 Capstone</span>
          </div>
          <p>© {new Date().getFullYear()} TaskManager. Warm Minimalism Navy & Coral Edition.</p>
        </div>
      </footer>
    </div>
  );
}
