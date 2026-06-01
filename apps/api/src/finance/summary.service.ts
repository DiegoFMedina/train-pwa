import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { categories, transactions } from "../db/schema";

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

function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(
      eq(transactions.userId, userId),
      isNull(transactions.coupleId),
    );
  }
  return eq(transactions.coupleId, scope.coupleId!);
}

@Injectable()
export class SummaryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async monthly(
    userId: string,
    scope: RequestScope,
    month: string,
  ): Promise<MonthlySummary> {
    const { from, to } = monthRange(month);

    const where = and(
      scopeCondition(userId, scope),
      isNull(transactions.deletedAt),
      gte(transactions.occurredOn, from),
      lt(transactions.occurredOn, to),
    );

    const [totals] = await this.db
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.kind}='income' then ${transactions.amount} else 0 end),0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.kind}='expense' then ${transactions.amount} else 0 end),0)`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(transactions)
      .where(where);

    const breakdown = await this.db
      .select({
        category_id: transactions.categoryId,
        category_name: categories.name,
        kind: transactions.kind,
        total: sql<string>`coalesce(sum(${transactions.amount}),0)`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(where)
      .groupBy(transactions.categoryId, categories.name, transactions.kind)
      .orderBy(sql`sum(${transactions.amount}) desc`);

    const income = Number(totals?.income ?? 0);
    const expense = Number(totals?.expense ?? 0);

    return {
      month,
      range: { from, to },
      income,
      expense,
      balance: income - expense,
      count: totals?.count ?? 0,
      by_category: breakdown.map((r) => ({
        category_id: r.category_id,
        category_name: r.category_name,
        kind: r.kind as "income" | "expense",
        total: Number(r.total),
        count: r.count,
      })),
    };
  }
}

function monthRange(month: string): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) {
    throw new Error(`Mes inválido: ${month} (esperado YYYY-MM)`);
  }
  const year = Number(m[1]);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) throw new Error(`Mes fuera de rango: ${month}`);

  const from = `${year}-${String(mm).padStart(2, "0")}-01`;
  const nextYear = mm === 12 ? year + 1 : year;
  const nextMonth = mm === 12 ? 1 : mm + 1;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { from, to };
}
