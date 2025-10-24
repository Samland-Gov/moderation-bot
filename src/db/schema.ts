import { integer, bigint, pgTable, varchar } from "drizzle-orm/pg-core";

export const checkRuns = pgTable("check_runs", {
  id: integer().primaryKey().notNull().generatedAlwaysAsIdentity(),
  owner: varchar().notNull(),
  repo: varchar().notNull(),
  checkRunId: bigint({mode: "number"}).notNull(),
  headSHA: varchar().notNull(),
  status: varchar().notNull(),
  conclusion: varchar(),
  dateCreated: varchar().notNull(),
});