/**
 * Thin client for the Django REST API.
 *
 * The base URL comes from VITE_API_URL (see .env.example) so the same build
 * points at a local Django server in development and a deployed one later.
 * Tokens are stored under the same keys the mobile app uses, so sharing a
 * session between the two clients stays straightforward.
 */

const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");

const TOKEN_KEY = "mn_access_token";
const REFRESH_KEY = "mn_refresh_token";
const USER_KEY = "mn_user";

export interface User {
  id: number | string;
  name: string;
  email: string;
}

export class ApiError extends Error {
  /** field name -> message, as Django REST returns for invalid forms */
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  save(access: string, refresh: string | undefined, user: User) {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/** Turns a DRF error body into a readable message plus per-field errors. */
function readErrors(body: unknown): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  let message = "";

  if (body && typeof body === "object") {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const text = Array.isArray(value) ? String(value[0]) : String(value);
      if (key === "detail" || key === "non_field_errors") message = text;
      else fields[key] = text;
    }
  }
  if (!message) {
    message = Object.keys(fields).length
      ? "Please check the highlighted fields."
      : "Something went wrong. Please try again.";
  }
  return { message, fields };
}

/** Exchanges the stored refresh token for a new access token. */
async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access?: string; refresh?: string };
    if (!body.access) return null;
    localStorage.setItem(TOKEN_KEY, body.access);
    if (body.refresh) localStorage.setItem(REFRESH_KEY, body.refresh);
    return body.access;
  } catch {
    return null;
  }
}

interface RequestOptions extends RequestInit {
  /**
   * Public endpoints (register / login / contact) must be called WITHOUT an
   * Authorization header. DRF authenticates before checking permissions, so a
   * stale token left in localStorage would 401 the request and lock the user
   * out of signing in at all.
   */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth: useAuth = true, ...init } = options;
  return send<T>(path, init, useAuth, true);
}

async function send<T>(
  path: string,
  init: RequestInit,
  useAuth: boolean,
  retryOn401: boolean
): Promise<T> {
  const token = useAuth ? auth.token() : null;
  let res: Response;

  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Check that the Medicine Notifier API is running."
    );
  }

  // An expired access token is recoverable: refresh once and replay. If the
  // refresh fails the session is genuinely dead, so clear it rather than
  // leaving a token behind that breaks every later request.
  if (res.status === 401 && useAuth && retryOn401) {
    const fresh = await refreshAccessToken();
    if (fresh) return send<T>(path, init, true, false);
    auth.clear();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const { message, fields } = readErrors(body);
    throw new ApiError(message, fields);
  }
  return body as T;
}

export const api = {
  /** POST /api/auth/register/ — public, never send a token */
  register: (name: string, email: string, password: string) =>
    request<{ access: string; refresh?: string; user: User }>("/auth/register/", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ name, email, password }),
    }),

  /** POST /api/auth/login/ — public, never send a token */
  login: (email: string, password: string) =>
    request<{ access: string; refresh?: string; user: User }>("/auth/login/", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),

  /** GET /api/auth/me/ */
  me: () => request<User>("/auth/me/"),

  /** POST /api/contact/ — public, never send a token */
  sendMessage: (name: string, email: string, message: string) =>
    request<{ detail: string }>("/contact/", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ name, email, message }),
    }),
};
