import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = ["todo", "in_progress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

const STATUS_BADGE = {
  todo: "bg-warm-100 text-navy-700 border border-warm-200",
  in_progress: "bg-coral-50 text-coral-700 border border-coral-200 font-medium",
  done: "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium",
};

const PRIORITY_BADGE = {
  low: "bg-navy-50 text-navy-700 border border-navy-200",
  medium: "bg-amber-50 text-amber-800 border border-amber-200",
  high: "bg-coral-100 text-coral-800 border border-coral-300 font-semibold",
};

const EMPTY = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  assigneeId: "",
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    try {
      const [t, u] = await Promise.all([
        api.get("/api/tasks"),
        api.get("/api/users"),
      ]);
      setTasks(t.tasks);
      setUsers(u.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ── Modal helpers ─────────────────────────────────────────────────────── */

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, assigneeId: user?.id || "" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      assigneeId: task.assigneeId || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        dueDate: form.dueDate || null,
        assigneeId: form.assigneeId || null,
      };
      if (editing) {
        await api.put(`/api/tasks/${editing.id}`, payload);
      } else {
        await api.post("/api/tasks", payload);
      }
      setShowModal(false);
      setLoading(true);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-warm-300 border-t-coral-500" />
        <span className="text-xs text-navy-500 font-medium tracking-wide">
          Loading tasks…
        </span>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-warm-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            Tasks
          </h1>
          <p className="text-sm text-navy-600 mt-1">
            Track, assign, and manage your team’s deliverables in one place.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold shadow-coral hover:shadow-warm-md transition-all transform hover:-translate-y-0.5"
        >
          <span>+ New Task</span>
        </button>
      </div>

      {error && (
        <div className="bg-coral-50 text-coral-800 p-4 rounded-xl border border-coral-200 text-sm font-medium">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-warm-300 p-8">
          <div className="w-12 h-12 rounded-xl bg-coral-50 text-coral-600 flex items-center justify-center mx-auto text-xl font-bold mb-3">
            📋
          </div>
          <h3 className="text-base font-bold text-navy-900 mb-1">No tasks recorded yet</h3>
          <p className="text-sm text-navy-500 max-w-sm mx-auto mb-6">
            Get started by creating your first task to track work and assignees.
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-coral-500 text-white text-sm font-semibold hover:bg-coral-600 shadow-coral transition-all"
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-warm rounded-2xl overflow-hidden border border-warm-200/90">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-warm-200">
              <thead className="bg-warm-100/70">
                <tr>
                  {["Task Details", "Status", "Priority", "Due Date", "Assignee", "Actions"].map(
                    (h, idx) => (
                      <th
                        key={h}
                        className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-navy-600 ${
                          idx === 5 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-200/70 bg-white">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-warm-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-navy-950">
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-xs text-navy-500 truncate max-w-sm mt-0.5">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                          STATUS_BADGE[t.status] || "bg-warm-100 text-navy-700"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                          PRIORITY_BADGE[t.priority] || "bg-warm-100 text-navy-700"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-navy-600 font-medium">
                      {t.dueDate
                        ? new Date(t.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-navy-700 font-medium">
                      {t.assigneeName ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-warm-100 text-navy-800 border border-warm-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-coral-500" />
                          <span>{t.assigneeName}</span>
                        </span>
                      ) : (
                        <span className="text-warm-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-3">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-navy-700 hover:text-navy-950 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-coral-600 hover:text-coral-800 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-lg border border-warm-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-warm-200 bg-warm-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy-950">
                {editing ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-navy-400 hover:text-navy-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-coral-50 text-coral-800 rounded-xl border border-coral-200 text-xs font-medium">
                    {formError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Conduct security audit for container images"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 placeholder-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add details, notes, or acceptance criteria…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 placeholder-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                {/* Status + Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                      Status
                    </label>
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                      Priority
                    </label>
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due date + Assignee */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                      Assignee
                    </label>
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl border border-warm-300 bg-warm-50/50 text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400 focus:border-coral-400"
                      value={form.assigneeId}
                      onChange={(e) =>
                        setForm({ ...form, assigneeId: e.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-warm-200 bg-warm-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-warm-300 rounded-xl text-sm font-semibold text-navy-700 hover:bg-warm-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-coral-500 text-white rounded-xl text-sm font-semibold hover:bg-coral-600 shadow-coral transition-all disabled:opacity-50"
                >
                  {submitting
                    ? "Saving…"
                    : editing
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
