import type {
  AuthResponse,
  Category,
  Couple,
  CoupleInvitation,
  CoupleWithMembers,
  CreateFinancialGoal,
  CreateMealPlan,
  CreateRoutine,
  CreateTransaction,
  Dish,
  DishIngredient,
  FinancialGoal,
  GoalContribution,
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
    patch: (body: {
      timezone?: string;
      language?: "es" | "en";
      theme?: "light" | "dark" | "system";
      default_currency?: string;
      quiet_hours_start?: string | null;
      quiet_hours_end?: string | null;
    }) => request<User>("/me", { method: "PATCH", body }),
  },
  couples: {
    me: () => request<CoupleWithMembers | null>("/couples/me"),
    create: (name: string) =>
      request<CoupleWithMembers>("/couples", {
        method: "POST",
        body: { name },
      }),
    rename: (id: string, name: string) =>
      request<Couple>(`/couples/${id}`, { method: "PATCH", body: { name } }),
    remove: (id: string) =>
      request<void>(`/couples/${id}`, { method: "DELETE" }),
    leave: (id: string) =>
      request<void>(`/couples/${id}/leave`, { method: "POST" }),
    kick: (id: string, userId: string) =>
      request<void>(`/couples/${id}/members/${userId}`, { method: "DELETE" }),
    createInvitation: (id: string, ttlHours = 24) =>
      request<CoupleInvitation>(`/couples/${id}/invitations`, {
        method: "POST",
        body: { ttl_hours: ttlHours },
      }),
    listInvitations: (id: string) =>
      request<CoupleInvitation[]>(`/couples/${id}/invitations`),
    revokeInvitation: (invitationId: string) =>
      request<void>(`/couples/invitations/${invitationId}`, {
        method: "DELETE",
      }),
    join: (code: string) =>
      request<CoupleWithMembers>("/couples/join", {
        method: "POST",
        body: { code },
      }),
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
  goals: {
    list: () => request<FinancialGoal[]>("/goals"),
    create: (body: CreateFinancialGoal) =>
      request<FinancialGoal>("/goals", { method: "POST", body }),
    update: (
      id: string,
      body: {
        name?: string;
        target_amount?: number;
        target_date?: string | null;
        status?: "active" | "achieved" | "archived";
      },
    ) => request<FinancialGoal>(`/goals/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<void>(`/goals/${id}`, { method: "DELETE" }),
    listContributions: (id: string) =>
      request<GoalContribution[]>(`/goals/${id}/contributions`),
    addContribution: (
      id: string,
      body: { amount: number; occurred_on: string; note?: string | null },
    ) =>
      request<GoalContribution>(`/goals/${id}/contributions`, {
        method: "POST",
        body,
      }),
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
    create: (body: {
      name: string;
      notes?: string | null;
      prep_minutes?: number | null;
    }) => request<Dish>("/dishes", { method: "POST", body }),
    remove: (id: string) =>
      request<void>(`/dishes/${id}`, { method: "DELETE" }),
    listIngredients: (id: string) =>
      request<DishIngredient[]>(`/dishes/${id}/ingredients`),
    addIngredient: (
      id: string,
      body: {
        name: string;
        amount?: number | null;
        unit?: string | null;
        quantity?: string | null;
      },
    ) =>
      request<DishIngredient>(`/dishes/${id}/ingredients`, {
        method: "POST",
        body,
      }),
    removeIngredient: (id: string, ingredientId: string) =>
      request<void>(`/dishes/${id}/ingredients/${ingredientId}`, {
        method: "DELETE",
      }),
    suggestions: (mealType?: MealType) =>
      request<DishSuggestion[]>(
        `/dishes/suggestions${mealType ? `?meal_type=${mealType}` : ""}`,
      ),
  },
  mealPlans: {
    list: (date?: string) =>
      request<MealPlan[]>(`/meal-plans${date ? `?date=${date}` : ""}`),
    listInRange: (from: string, to: string) =>
      request<MealPlan[]>(
        `/meal-plans?from=${from}&to=${to}`,
      ),
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

export interface DishSuggestion {
  dish: Dish;
  bucket: "stale" | "favorite" | "recent" | "never";
  last_used_on: string | null;
  uses_30d: number;
  uses_total: number;
}

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
