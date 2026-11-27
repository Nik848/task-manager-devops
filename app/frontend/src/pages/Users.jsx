import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/users/manage");
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleRoleChange = async (userId, newRole) => {
    clearMessages();
    try {
      const data = await api.patch(`/api/users/${userId}/role`, {
        role: newRole,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
      setSuccess("Role updated successfully");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    clearMessages();
    try {
      const data = await api.patch(`/api/users/${userId}/status`, {
        isActive: !currentStatus,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
      setSuccess(
        `User ${data.user.isActive ? "enabled" : "disabled"} successfully`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId) => {
    clearMessages();
    try {
      await api.delete(`/api/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDelete(null);
      setSuccess("User deleted successfully");
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-warm-300 border-t-coral-500" />
        <span className="text-xs text-navy-500 font-medium tracking-wide">
          Loading user registry…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-warm-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-coral-600 bg-coral-50 px-2.5 py-0.5 rounded-full border border-coral-200">
            Admin Governance
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight mt-1.5">
          User Management
        </h1>
        <p className="text-sm text-navy-600 mt-1">
          Review member permissions, grant administrative privileges, and enable or disable account access.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-coral-50 border border-coral-200 text-coral-800 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}

      <div className="bg-white shadow-warm rounded-2xl overflow-hidden border border-warm-200/90">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-warm-200">
            <thead className="bg-warm-100/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-navy-600">
                  User
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-navy-600">
                  Email
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-navy-600">
                  Role
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-navy-600">
                  Status
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-navy-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-warm-200/70">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={isSelf ? "bg-coral-50/30" : "hover:bg-warm-50/80 transition-colors"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-navy-900 text-white font-bold text-xs flex items-center justify-center border border-navy-800">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-navy-950">
                            {u.name}
                          </span>
                          {isSelf && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-coral-100 text-coral-800 px-2 py-0.5 rounded-full border border-coral-200">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-navy-600 font-medium">
                      {u.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`border border-warm-300 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          isSelf
                            ? "bg-warm-100 text-warm-400 cursor-not-allowed"
                            : "bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-coral-400"
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        disabled={isSelf}
                        onClick={() => handleStatusToggle(u.id, u.isActive)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isSelf
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        } ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-coral-50 text-coral-800 border border-coral-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${u.isActive ? "bg-emerald-500" : "bg-coral-500"}`} />
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                      {confirmDelete === u.id ? (
                        <div className="flex items-center justify-end space-x-2">
                          <span className="text-coral-700 text-xs font-bold">Confirm delete?</span>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-xs bg-coral-600 text-white px-2.5 py-1 rounded-lg hover:bg-coral-700 shadow-xs"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs bg-warm-200 text-navy-700 px-2.5 py-1 rounded-lg hover:bg-warm-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isSelf}
                          onClick={() => setConfirmDelete(u.id)}
                          className={`text-coral-600 hover:text-coral-800 font-semibold ${
                            isSelf
                              ? "cursor-not-allowed opacity-40"
                              : "cursor-pointer"
                          }`}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
