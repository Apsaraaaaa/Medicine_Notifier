// Service layer talking to the Django REST backend (../backend).
//
// Base URL resolution, in order:
//   1. EXPO_PUBLIC_API_URL from .env / app config   (always wins)
//   2. the LAN address Metro is served from, port 8000
//      — a physical phone running Expo Go reaches the dev machine this way
//   3. http://10.0.2.2:8000/api on an Android emulator (the host's localhost)
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { STORAGE_KEYS } from "../constants/theme";
import { storage } from "../utils/storage";
import type { CatalogMedicine, HistoryEntry, Medicine, User } from "../types";

/** Carries the HTTP status so callers can tell "rejected" from "offline". */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function metroHost(): string | null {
  // "192.168.1.20:8081" while the app is served by the dev server.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function resolveBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;

  // An Android emulator reaches the host machine through 10.0.2.2, which is
  // NAT'd internally. Prefer it over the LAN address Metro reports: the two
  // are equivalent only if Windows Firewall lets the emulator back in on that
  // interface, and on a freshly joined network it usually does not.
  if (Platform.OS === "android" && !Device.isDevice) return "http://10.0.2.2:8000/api";

  // A physical phone has no such shortcut, so it uses the address Metro is
  // being served from — which is why it needs no configuration.
  const host = metroHost();
  if (host) return `http://${host}:8000/api`;

  return Platform.OS === "android" ? "http://10.0.2.2:8000/api" : "http://127.0.0.1:8000/api";
}

export const API_BASE = resolveBase().replace(/\/$/, "");

/** Turns a DRF error body into the single readable string the screens render. */
function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    // `detail` / `non_field_errors` are whole-request errors; prefer them.
    for (const key of ["detail", "non_field_errors"]) {
      const value = record[key];
      if (value) return Array.isArray(value) ? String(value[0]) : String(value);
    }
    const entries = Object.entries(record);
    if (entries.length) {
      const [field, value] = entries[0];
      const text = Array.isArray(value) ? String(value[0]) : String(value);
      return `${field}: ${text}`;
    }
  }
  return fallback;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await storage.get<string | null>(STORAGE_KEYS.refresh, null);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const body = (await readBody(res)) as { access?: string; refresh?: string } | null;
    if (!body?.access) return null;
    await storage.set(STORAGE_KEYS.token, body.access);
    // Refresh rotation is on server-side, so store the replacement when sent.
    if (body.refresh) await storage.set(STORAGE_KEYS.refresh, body.refresh);
    return body.access;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const token = await storage.get<string | null>(STORAGE_KEYS.token, null);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    // status 0 = never reached the server (offline / server down).
    throw new ApiError(
      `Can't reach the server at ${API_BASE}. Check that the Django API is running.`,
      0
    );
  }

  // An expired access token is recoverable: refresh once, then replay.
  if (res.status === 401 && retryOn401) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(path, options, false);
  }

  const body = await readBody(res);
  if (!res.ok) {
    throw new ApiError(messageFrom(body, "Something went wrong. Please try again."), res.status);
  }
  return body as T;
}

/** DRF returns a plain array here, but tolerate a paginated shape too. */
function listOf<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && Array.isArray((body as { results?: T[] }).results)) {
    return (body as { results: T[] }).results;
  }
  return [];
}

interface AuthResponse {
  access: string;
  refresh?: string;
  user: User;
}

async function persistSession(res: AuthResponse) {
  await storage.set(STORAGE_KEYS.token, res.access);
  if (res.refresh) await storage.set(STORAGE_KEYS.refresh, res.refresh);
  await storage.set(STORAGE_KEYS.user, res.user);
}

async function clearSession() {
  await storage.remove(STORAGE_KEYS.token);
  await storage.remove(STORAGE_KEYS.refresh);
  await storage.remove(STORAGE_KEYS.user);
}

/**
 * Validates a stored session against the API on startup.
 *
 * Returns null — after clearing the stored session — when the server rejects
 * the token, so a stale session can't leave the app looking signed in while
 * every request fails with 401.
 *
 * A network failure is not a rejection: if the API is simply unreachable the
 * stored session is kept so the app still opens.
 */
export async function restoreSession(): Promise<{ token: string; user: User } | null> {
  const stored = await storage.get<string | null>(STORAGE_KEYS.token, null);
  if (!stored) return null;

  try {
    const user = await request<User>("/auth/me/");
    await storage.set(STORAGE_KEYS.user, user);
    // request() may have rotated the access token mid-flight.
    const current = await storage.get<string | null>(STORAGE_KEYS.token, stored);
    return { token: current ?? stored, user };
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      const user = await storage.get<User | null>(STORAGE_KEYS.user, null);
      return user ? { token: stored, user } : null;
    }
    await clearSession();
    return null;
  }
}

// ---- AUTH ----

// POST /api/auth/register/
export async function register(name: string, email: string, password: string) {
  const res = await request<AuthResponse>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  await persistSession(res);
  return { token: res.access, user: res.user };
}

// POST /api/auth/login/
export async function login(email: string, password: string) {
  const res = await request<AuthResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await persistSession(res);
  return { token: res.access, user: res.user };
}

// POST /api/auth/logout/ — best effort; the local session is cleared regardless.
export async function logout() {
  const refresh = await storage.get<string | null>(STORAGE_KEYS.refresh, null);
  if (refresh) {
    try {
      await request("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) });
    } catch {
      // Offline or already-expired token: clearing locally is still correct.
    }
  }
  await clearSession();
}

// PATCH /api/auth/profile/
export async function updateProfile(name: string): Promise<User> {
  const user = await request<User>("/auth/profile/", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  await storage.set(STORAGE_KEYS.user, user);
  return user;
}

// POST /api/auth/change-password/
export async function changePassword(oldPw: string, newPw: string) {
  await request("/auth/change-password/", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
  });
}

// ---- MEDICINES ----

// GET /api/medicines/
export async function getMedicines(): Promise<Medicine[]> {
  return listOf<Medicine>(await request<unknown>("/medicines/"));
}

// POST /api/medicines/
export async function createMedicine(data: Omit<Medicine, "id">): Promise<Medicine> {
  return request<Medicine>("/medicines/", { method: "POST", body: JSON.stringify(data) });
}

// PUT /api/medicines/{id}/
export async function updateMedicine(
  id: string,
  data: Omit<Medicine, "id">
): Promise<Medicine> {
  return request<Medicine>(`/medicines/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

// DELETE /api/medicines/{id}/
export async function deleteMedicine(id: string): Promise<void> {
  await request<void>(`/medicines/${id}/`, { method: "DELETE" });
}

// ---- CATALOG (shared reference data, read-only) ----

// GET /api/catalog/?q=para&limit=8
// Every suggestion the form shows comes from here — there is no local list.
export async function searchCatalog(
  query: string,
  limit = 8,
  signal?: AbortSignal
): Promise<CatalogMedicine[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return listOf<CatalogMedicine>(
    await request<unknown>(`/catalog/?${params.toString()}`, { signal })
  );
}

// ---- HISTORY (dose log) ----

// GET /api/history/
export async function getHistory(): Promise<HistoryEntry[]> {
  return listOf<HistoryEntry>(await request<unknown>("/history/"));
}

// POST /api/history/
// The server assigns the real id, so only the meaningful fields are sent.
export async function addHistory(entry: Omit<HistoryEntry, "id">): Promise<HistoryEntry> {
  return request<HistoryEntry>("/history/", {
    method: "POST",
    body: JSON.stringify({
      medicineId: entry.medicineId,
      medicineName: entry.medicineName,
      dosage: entry.dosage,
      time: entry.time,
      date: entry.date,
      status: entry.status,
      recordedAt: entry.recordedAt,
      note: entry.note ?? "",
    }),
  });
}
