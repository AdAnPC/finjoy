import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  deviceModel: text("device_model").notNull(),
  deviceImei: text("device_imei"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }).notNull(),
  nextDueDate: timestamp("next_due_date").notNull(),
  startDate: timestamp("start_date").notNull(),
  totalMonths: integer("total_months").notNull(),
  paidMonths: integer("paid_months").notNull().default(0),
  gracePeriodDays: integer("grace_period_days").notNull().default(3),
  status: text("status", { enum: ["active", "due_soon", "overdue", "locked", "completed"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
