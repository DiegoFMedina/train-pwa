import type {
  AuthResponse,
  Category,
  CreateTransaction,
  LoginRequest,
  RegisterRequest,
  Transaction,
  TransactionFilter,
  User,
} from "@mi-centro/shared";
import { useAuthStore } from "./auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOpts = Omit<RequestInit, "body"> & { body?: unknown; skipAuth?: boolean };

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = opts;
  const token = skipAuth ? null : useAuthStore.getState().accessToken;

  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(`${BASE}${path}`, init);

  // Si el access expiró, intentar refresh transparente UNA vez.
  if (res.status === 401 && !skipAuth && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  if (!res.ok) {
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, parsed, `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        useAuthStore.getState().clear();
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      useAuthStore.getState().setAccessToken(data.access_token);
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface MonthlySummary {
  month: string;
  range: { from: string; to: string };
  income: number;
  expense: number;
  balance: number;
  count: number;
  by_category: Array<{
    category_id: string | null;
    category_name: string | null;
    kind: "income" | "expense";
    total: number;
    count: number;
  }>;
}

export const api = {
  auth: {
    register: (body: RegisterRequest) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body,
        skipAuth: true,
      }),
    login: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body,
        skipAuth: true,
      }),
    refresh: () =>
      request<{ access_token: string; access_expires_in: number }>(
        "/auth/refresh",
        { method: "POST", skipAuth: true },
      ),
    logout: () =>
      request<void>("/auth/logout", { method: "POST", skipAuth: true }),
  },
  me: {
    get: () => request<User>("/me"),
  },
  categories: {
    list: () => request<Category[]>("/categories"),
    create: (body: { name: string; kind: "income" | "expense"; color?: string | null; icon?: string | null }) =>
      request<Category>("/categories", { method: "POST", body }),
  },
  transactions: {
    list: (filter: TransactionFilter = {}) => {
      const q = new URLSearchParams();
      if (filter.from) q.set("from", filter.from);
      if (filter.to) q.set("to", filter.to);
      if (filter.kind) q.set("kind", filter.kind);
      if (filter.category_id) q.set("category_id", filter.category_id);
      const s = q.toString();
      return request<Transaction[]>(`/transactions${s ? `?${s}` : ""}`);
    },
    create: (body: CreateTransaction) =>
      request<Transaction>("/transactions", { method: "POST", body }),
    remove: (id: string) =>
      request<void>(`/transactions/${id}`, { method: "DELETE" }),
  },
  summary: {
    monthly: (month?: string) =>
      request<MonthlySummary>(
        `/finance/summary${month ? `?month=${month}` : ""}`,
      ),
  },
};

export { ApiError };
