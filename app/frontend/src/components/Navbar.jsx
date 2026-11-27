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

  const navItem = (path, label) => {
    const isActive = location.pathname === path;
    return (
      <Link
        to={path}
        onClick={() => setOpen(false)}
        className={`relative px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          isActive
            ? "text-coral-600 bg-coral-50/80 shadow-sm"
            : "text-navy-700 hover:text-navy-950 hover:bg-warm-100"
        }`}
      >
        {label}
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-coral-500 rounded-full" />
        )}
      </Link>
    );
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-warm-200/90 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand Logo & Links */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center text-white font-bold text-base shadow-sm transition-transform group-hover:scale-105 border border-navy-800">
                <span className="text-coral-500 font-black">T</span>M
              </div>
              <span className="text-lg font-bold tracking-tight text-navy-950">
                TaskManager
              </span>
            </Link>

            <div className="hidden sm:flex items-center space-x-1.5">
              {navItem("/dashboard", "Dashboard")}
              {navItem("/tasks", "Tasks")}
              {user?.role === "admin" && navItem("/users", "User Management")}
            </div>
          </div>

          {/* Right section: User info & Logout */}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-warm-100/70 border border-warm-200">
              <div className="w-7 h-7 rounded-lg bg-coral-500 text-white flex items-center justify-center text-xs font-bold shadow-coral">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-navy-900 leading-tight">
                  {user?.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-coral-600">
                  {user?.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-navy-600 hover:text-coral-600 hover:bg-coral-50 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Hamburger (mobile) */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-lg text-navy-600 hover:text-navy-900 hover:bg-warm-100 focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {open && (
        <div className="sm:hidden border-t border-warm-200 bg-white/95 px-4 pt-3 pb-4 space-y-2">
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-navy-800 hover:bg-warm-100"
          >
            Dashboard
          </Link>
          <Link
            to="/tasks"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-navy-800 hover:bg-warm-100"
          >
            Tasks
          </Link>
          {user?.role === "admin" && (
            <Link
              to="/users"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-navy-800 hover:bg-warm-100"
            >
              User Management
            </Link>
          )}

          <div className="border-t border-warm-200 pt-3 mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-coral-500 text-white flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-navy-900">{user?.name}</span>
                <span className="text-[10px] text-warm-500 uppercase">{user?.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-coral-600 bg-coral-50 hover:bg-coral-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
