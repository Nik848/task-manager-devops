import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/tasks/stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-warm-300 border-t-coral-500" />
        <span className="text-xs text-navy-500 font-medium tracking-wide">
          Loading metrics & tasks…
        </span>
      </div>
    );

  if (error)
    return (
      <div className="bg-coral-50 text-coral-800 p-4 rounded-xl border border-coral-200 text-sm font-medium">
        {error}
      </div>
    );

  return (
    <div className="space-y-8">
      {/* ── Welcome Banner ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-warm-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-navy-600 mt-1">
            Welcome back, <span className="font-semibold text-navy-900">{user?.name}</span>. Here is your operational overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/tasks"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold shadow-coral hover:shadow-warm-md transition-all transform hover:-translate-y-0.5"
          >
            <span>Manage Tasks</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* ── Overview Metric Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card
          label="Total Tasks"
          value={stats.total}
          subtitle="All recorded items"
          accent="bg-navy-900 text-white"
          badgeColor="text-navy-900"
        />
        <Card
          label="In Progress"
          value={stats.byStatus.in_progress}
          subtitle="Currently active"
          accent="bg-coral-500 text-white"
          badgeColor="text-coral-600"
        />
        <Card
          label="Completed"
          value={stats.byStatus.done}
          subtitle="Successfully delivered"
          accent="bg-emerald-600 text-white"
          badgeColor="text-emerald-600"
        />
        <Card
          label="Overdue"
          value={stats.overdue}
          subtitle="Needs immediate attention"
          accent="bg-coral-600 text-white"
          badgeColor="text-coral-700"
        />
      </div>

      {/* ── Visual Breakdown Sections ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Tasks by Status" badge="Real-time">
          <Bar
            label="To Do"
            value={stats.byStatus.todo}
            total={stats.total}
            color="bg-warm-400"
          />
          <Bar
            label="In Progress"
            value={stats.byStatus.in_progress}
            total={stats.total}
            color="bg-coral-500"
          />
          <Bar
            label="Done"
            value={stats.byStatus.done}
            total={stats.total}
            color="bg-emerald-500"
          />
        </Section>

        <Section title="Tasks by Priority" badge="Distribution">
          <Bar
            label="High"
            value={stats.byPriority.high}
            total={stats.total}
            color="bg-coral-600"
          />
          <Bar
            label="Medium"
            value={stats.byPriority.medium}
            total={stats.total}
            color="bg-amber-400"
          />
          <Bar
            label="Low"
            value={stats.byPriority.low}
            total={stats.total}
            color="bg-navy-400"
          />
        </Section>
      </div>
    </div>
  );
}

/* ── Subcomponents ─────────────────────────────────────────────────────────── */

function Card({ label, value, subtitle, accent, badgeColor }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-warm border border-warm-200/90 hover:shadow-warm-md transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-navy-500">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${accent} shadow-sm`}>
          #
        </div>
      </div>
      <div className="mt-4">
        <span className={`text-3xl font-extrabold tracking-tight ${badgeColor}`}>
          {value}
        </span>
        <span className="text-xs text-navy-400 block mt-1 font-medium">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

function Section({ title, badge, children }) {
  return (
    <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-warm border border-warm-200/90">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-navy-950 tracking-tight">
          {title}
        </h2>
        {badge && (
          <span className="text-[11px] font-semibold text-navy-500 bg-warm-100 px-2.5 py-0.5 rounded-full border border-warm-200">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Bar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1.5">
        <span className="text-navy-700">{label}</span>
        <div className="space-x-1.5">
          <span className="text-navy-900 font-bold">{value}</span>
          <span className="text-warm-400 text-[10px]">({pct}%)</span>
        </div>
      </div>
      <div className="w-full bg-warm-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-warm-200/50">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
