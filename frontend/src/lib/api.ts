import { getToken } from "./auth";

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

export interface Note {
  id: string;
  title: string;
  body: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const notesApi = {
  list: () => apiFetch<Note[]>("/notes"),
  get: (id: string) => apiFetch<Note>(`/notes/${id}`),
  create: (data: { title: string; body?: string }) =>
    apiFetch<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; body?: string }) =>
    apiFetch<Note>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/notes/${id}`, { method: "DELETE" }),
};
