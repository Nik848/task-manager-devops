import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function Dashboard() {
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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>
    );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card label="Total Tasks" value={stats.total} bg="bg-indigo-500" />
        <Card label="In Progress" value={stats.byStatus.in_progress} bg="bg-yellow-500" />
        <Card label="Completed" value={stats.byStatus.done} bg="bg-green-500" />
        <Card label="Overdue" value={stats.overdue} bg="bg-red-500" />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="By Status">
          <Bar label="To Do" value={stats.byStatus.todo} total={stats.total} color="bg-gray-400" />
          <Bar label="In Progress" value={stats.byStatus.in_progress} total={stats.total} color="bg-yellow-400" />
          <Bar label="Done" value={stats.byStatus.done} total={stats.total} color="bg-green-400" />
        </Section>

        <Section title="By Priority">
          <Bar label="High" value={stats.byPriority.high} total={stats.total} color="bg-red-400" />
          <Bar label="Medium" value={stats.byPriority.medium} total={stats.total} color="bg-yellow-400" />
          <Bar label="Low" value={stats.byPriority.low} total={stats.total} color="bg-blue-400" />
        </Section>
      </div>
    </div>
  );
}

/* ── Subcomponents ─────────────────────────────────────────────────────────── */

function Card({ label, value, bg }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex items-center space-x-4">
      <div className={`${bg} rounded-full h-12 w-12 flex items-center justify-center`}>
        <span className="text-white text-lg font-bold">{value}</span>
      </div>
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Bar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
