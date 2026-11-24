import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const link = (path, label) => (
    <Link
      to={path}
      onClick={() => setOpen(false)}
      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
        location.pathname === path
          ? "border-indigo-500 text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left */}
          <div className="flex items-center space-x-8">
            <span className="text-xl font-bold text-indigo-600">
              TaskManager
            </span>
            <div className="hidden sm:flex space-x-8">
              {link("/dashboard", "Dashboard")}
              {link("/tasks", "Tasks")}
            </div>
          </div>

          {/* Right (desktop) */}
          <div className="hidden sm:flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {user?.name}{" "}
              <span className="text-xs text-gray-400">({user?.role})</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>

          {/* Hamburger (mobile) */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setOpen(!open)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {open ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-gray-200 py-2 px-4 space-y-1">
          <Link
            to="/dashboard"
            className="block py-2 text-sm text-gray-700"
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            to="/tasks"
            className="block py-2 text-sm text-gray-700"
            onClick={() => setOpen(false)}
          >
            Tasks
          </Link>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <span className="block py-1 text-sm text-gray-500">
              {user?.name} ({user?.role})
            </span>
            <button
              onClick={handleLogout}
              className="block py-1 text-sm text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
