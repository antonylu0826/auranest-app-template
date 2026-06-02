import { type UserRole, getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export const usersApi = {
  list: () => apiFetch<User[]>("/users"),
  get: (id: string) => apiFetch<User>(`/users/${id}`),
  create: (data: { email: string; password: string; name?: string; role?: UserRole }) =>
    apiFetch<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    apiFetch<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateRole: (id: string, role: UserRole) =>
    apiFetch<User>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
};

