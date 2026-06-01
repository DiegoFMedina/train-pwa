import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  customType,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// citext: email case-insensitive. Drizzle no lo trae nativo así que lo declaramos custom.
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

// ─── Núcleo ───────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  email: citext("email").notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("America/Santiago"),
  language: varchar("language", { length: 5 }).notNull().default("es"),
  theme: varchar("theme", { length: 10 }).notNull().default("system"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("CLP"),
  quietHoursStart: time("quiet_hours_start"),
  quietHoursEnd: time("quiet_hours_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceLabel: varchar("device_label", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userEndpoint: uniqueIndex("push_subscriptions_user_endpoint_uq").on(
      t.userId,
      t.endpoint,
    ),
  }),
);

// ─── Finanzas ─────────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coupleId: uuid("couple_id"),
    name: varchar("name", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 10 }).notNull(),
    color: varchar("color", { length: 7 }),
    icon: varchar("icon", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    kindCheck: check("categories_kind_check", sql`${t.kind} IN ('income','expense')`),
    userIdx: index("idx_cat_user")
      .on(t.userId)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export const recurringTransactions = pgTable("recurring_transactions", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  coupleId: uuid("couple_id"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  kind: varchar("kind", { length: 10 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("CLP"),
  description: text("description"),
  rrule: text("rrule").notNull(),
  nextRunOn: date("next_run_on").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coupleId: uuid("couple_id"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 10 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("CLP"),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    recurringId: uuid("recurring_id").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    kindCheck: check("transactions_kind_check", sql`${t.kind} IN ('income','expense')`),
    userDate: index("idx_tx_user_date")
      .on(t.userId, t.occurredOn)
      .where(sql`${t.deletedAt} IS NULL`),
    userCategory: index("idx_tx_user_category")
      .on(t.userId, t.categoryId)
      .where(sql`${t.deletedAt} IS NULL`),
    sync: index("idx_tx_sync").on(t.userId, t.updatedAt),
  }),
);

export const financialGoals = pgTable(
  "financial_goals",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coupleId: uuid("couple_id"),
    name: varchar("name", { length: 120 }).notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("CLP"),
    targetDate: date("target_date"),
    status: varchar("status", { length: 12 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    statusCheck: check(
      "financial_goals_status_check",
      sql`${t.status} IN ('active','achieved','archived')`,
    ),
    userIdx: index("idx_goal_user")
      .on(t.userId)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export const goalContributions = pgTable("goal_contributions", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => financialGoals.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  occurredOn: date("occurred_on").notNull().defaultNow(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

// ─── Rutinas ──────────────────────────────────────────────────

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coupleId: uuid("couple_id"),
    title: varchar("title", { length: 120 }).notNull(),
    notes: text("notes"),
    rrule: text("rrule").notNull(),
    timeOfDay: time("time_of_day").notNull(),
    durationMinutes: integer("duration_minutes").default(30),
    notifyMode: varchar("notify_mode", { length: 12 }).notNull().default("notify"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    notifyCheck: check(
      "routines_notify_check",
      sql`${t.notifyMode} IN ('notify','vibrate','silent')`,
    ),
    userIdx: index("idx_routine_user_active")
      .on(t.userId)
      .where(sql`${t.deletedAt} IS NULL AND ${t.active} = true`),
  }),
);

export const routineLogs = pgTable(
  "routine_logs",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dueOn: date("due_on").notNull(),
    status: varchar("status", { length: 10 }).notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    statusCheck: check(
      "routine_logs_status_check",
      sql`${t.status} IN ('pending','done','skipped','missed')`,
    ),
    uniqueRoutineUserDay: uniqueIndex("routine_logs_routine_user_day_uq").on(
      t.routineId,
      t.userId,
      t.dueOn,
    ),
    userDate: index("idx_rlog_user_date")
      .on(t.userId, t.dueOn)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

// ─── Dieta ────────────────────────────────────────────────────

export const dishes = pgTable("dishes", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  coupleId: uuid("couple_id"),
  name: varchar("name", { length: 120 }).notNull(),
  notes: text("notes"),
  prepMinutes: integer("prep_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const dishIngredients = pgTable("dish_ingredients", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  dishId: uuid("dish_id")
    .notNull()
    .references(() => dishes.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 3 }),
  unit: varchar("unit", { length: 20 }),
  quantity: varchar("quantity", { length: 60 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id").references(() => dishes.id, { onDelete: "set null" }),
    planDate: date("plan_date").notNull(),
    mealType: varchar("meal_type", { length: 12 }).notNull(),
    cookTime: time("cook_time"),
    eatTime: time("eat_time"),
    notifyMode: varchar("notify_mode", { length: 12 }).notNull().default("notify"),
    status: varchar("status", { length: 10 }).notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => ({
    mealCheck: check(
      "meal_plans_type_check",
      sql`${t.mealType} IN ('breakfast','lunch','dinner','snack')`,
    ),
    statusCheck: check(
      "meal_plans_status_check",
      sql`${t.status} IN ('planned','eaten','skipped')`,
    ),
    userDate: index("idx_meal_user_date")
      .on(t.userId, t.planDate)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

// ─── Reminders (cola para el cron) ────────────────────────────

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body"),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    notifyMode: varchar("notify_mode", { length: 12 }).notNull().default("notify"),
    status: varchar("status", { length: 12 }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceCheck: check(
      "reminders_source_check",
      sql`${t.sourceType} IN ('routine','meal','goal','transaction')`,
    ),
    statusCheck: check(
      "reminders_status_check",
      sql`${t.status} IN ('pending','sent','cancelled')`,
    ),
    pendingFire: index("idx_reminders_pending")
      .on(t.fireAt)
      .where(sql`${t.status} = 'pending'`),
  }),
);

// ─── Couples (espacio compartido entre 2 personas) ────────────

export const couples = pgTable("couples", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  name: varchar("name", { length: 80 }).notNull().default("Nuestra cuenta"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const coupleMembers = pgTable(
  "couple_members",
  {
    coupleId: uuid("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 10 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    pk: { columns: [t.coupleId, t.userId], name: "couple_members_pkey" },
    roleCheck: check(
      "couple_members_role_check",
      sql`${t.role} IN ('owner','member')`,
    ),
    userUnique: uniqueIndex("idx_couple_members_user_unique").on(t.userId),
  }),
);

export const coupleInvitations = pgTable("couple_invitations", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  coupleId: uuid("couple_id")
    .notNull()
    .references(() => couples.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 16 }).notNull().unique(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Tipos exportados ─────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineLog = typeof routineLogs.$inferSelect;
export type Dish = typeof dishes.$inferSelect;
export type DishIngredient = typeof dishIngredients.$inferSelect;
export type MealPlan = typeof mealPlans.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Couple = typeof couples.$inferSelect;
export type CoupleMember = typeof coupleMembers.$inferSelect;
export type CoupleInvitation = typeof coupleInvitations.$inferSelect;
