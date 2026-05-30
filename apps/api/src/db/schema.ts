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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
