import { type UserRole } from "./auth";
import { apiFetch, toQueryString, type ListQuery, type PaginatedResult } from "./api";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  role: UserRole;
  scopes: string[];
  rateLimit: number | null;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyResult extends ApiKey {
  key: string;
}

export interface CreateApiKeyDto {
  name: string;
  role: UserRole;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface UpdateApiKeyDto {
  name?: string;
  role?: UserRole;
  scopes?: string[];
  rateLimit?: number | null;
  isActive?: boolean;
  expiresAt?: string | null;
}

export const apiKeysApi = {
  list: (query?: ListQuery) =>
    apiFetch<PaginatedResult<ApiKey>>(`/api-keys${toQueryString({ ...query })}`),
  get: (id: string) => apiFetch<ApiKey>(`/api-keys/${id}`),
  create: (dto: CreateApiKeyDto) =>
    apiFetch<CreateApiKeyResult>("/api-keys", {
      method: "POST",
      body: JSON.stringify(dto),
    }),
  update: (id: string, dto: UpdateApiKeyDto) =>
    apiFetch<ApiKey>(`/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),
  remove: (id: string) => apiFetch<void>(`/api-keys/${id}`, { method: "DELETE" }),
};

export async function getAvailableScopes(): Promise<string[]> {
  const meta = await apiFetch<{ availableScopes: string[] }>("/meta/schema");
  return meta.availableScopes;
}
