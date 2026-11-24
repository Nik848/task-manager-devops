const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Cannot connect to backend server at ${API_URL}. Please ensure the backend server is running.`
    );
  }

  // Handle 401 for authenticated endpoints (exclude login & signup)
  if (
    res.status === 401 &&
    path !== "/api/auth/login" &&
    path !== "/api/auth/signup"
  ) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: res.statusText || "Request failed" };
  }

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
