import type {
  AuthResponse,
  Category,
  CreateMealPlan,
  CreateRoutine,
  CreateTransaction,
  Dish,
  DishIngredient,
  LoginRequest,
  MealPlan,
  MealType,
  RegisterRequest,
  Routine,
  RoutineLogStatus,
  ShoppingList,
  Transaction,
  TransactionFilter,
  UpdateMealPlan,
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
    create: (body: {
      name: string;
      kind: "income" | "expense";
      color?: string | null;
      icon?: string | null;
    }) => request<Category>("/categories", { method: "POST", body }),
    update: (
      id: string,
      body: { name?: string; kind?: "income" | "expense"; color?: string | null; icon?: string | null },
    ) => request<Category>(`/categories/${id}`, { method: "PATCH", body }),
    remove: (id: string) =>
      request<void>(`/categories/${id}`, { method: "DELETE" }),
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
    update: (
      id: string,
      body: {
        kind?: "income" | "expense";
        amount?: number;
        currency?: string;
        category_id?: string | null;
        description?: string | null;
        occurred_on?: string;
      },
    ) => request<Transaction>(`/transactions/${id}`, { method: "PATCH", body }),
    remove: (id: string) =>
      request<void>(`/transactions/${id}`, { method: "DELETE" }),
  },
  summary: {
    monthly: (month?: string) =>
      request<MonthlySummary>(
        `/finance/summary${month ? `?month=${month}` : ""}`,
      ),
  },
  routines: {
    list: () => request<Routine[]>("/routines"),
    create: (body: CreateRoutine) =>
      request<Routine>("/routines", { method: "POST", body }),
    remove: (id: string) =>
      request<void>(`/routines/${id}`, { method: "DELETE" }),
    instances: (date?: string) =>
      request<RoutineInstance[]>(
        `/routines/instances${date ? `?date=${date}` : ""}`,
      ),
    markLog: (body: { routine_id: string; due_on: string; status: RoutineLogStatus }) =>
      request("/routines/logs", { method: "POST", body }),
    stats: (id: string, from?: string, to?: string) => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const s = q.toString();
      return request<RoutineStats>(`/routines/${id}/stats${s ? `?${s}` : ""}`);
    },
  },
  dishes: {
    list: () => request<Dish[]>("/dishes"),
    create: (body: { name: string; notes?: string | null; prep_minutes?: number | null }) =>
      request<Dish>("/dishes", { method: "POST", body }),
    remove: (id: string) =>
      request<void>(`/dishes/${id}`, { method: "DELETE" }),
    listIngredients: (id: string) =>
      request<DishIngredient[]>(`/dishes/${id}/ingredients`),
    addIngredient: (id: string, body: { name: string; quantity?: string | null }) =>
      request<DishIngredient>(`/dishes/${id}/ingredients`, {
        method: "POST",
        body,
      }),
    removeIngredient: (id: string, ingredientId: string) =>
      request<void>(`/dishes/${id}/ingredients/${ingredientId}`, {
        method: "DELETE",
      }),
  },
  mealPlans: {
    list: (date?: string) =>
      request<MealPlan[]>(`/meal-plans${date ? `?date=${date}` : ""}`),
    create: (body: CreateMealPlan) =>
      request<MealPlan>("/meal-plans", { method: "POST", body }),
    update: (id: string, body: UpdateMealPlan) =>
      request<MealPlan>(`/meal-plans/${id}`, { method: "PATCH", body }),
    remove: (id: string) =>
      request<void>(`/meal-plans/${id}`, { method: "DELETE" }),
    shoppingList: (from?: string, to?: string) => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const s = q.toString();
      return request<ShoppingList>(
        `/meal-plans/shopping-list${s ? `?${s}` : ""}`,
      );
    },
  },
};

export interface RoutineInstance {
  routine: Routine;
  due_on: string;
  status: RoutineLogStatus;
  log_id: string | null;
}

export interface RoutineStats {
  routine_id: string;
  range_from: string;
  range_to: string;
  expected: number;
  done: number;
  skipped: number;
  missed: number;
  completion_rate: number;
  current_streak: number;
}

export type { MealType };

export { ApiError };
