import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientAccountsTable = pgTable("client_accounts", {
  clientId: integer("client_id")
    .primaryKey()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash"),
  activationCodeHash: text("activation_code_hash"),
  activationCodeExpiresAt: timestamp("activation_code_expires_at"),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerSessionsTable = pgTable(
  "customer_sessions",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("customer_sessions_token_hash_idx").on(table.tokenHash)],
);

export type ClientAccount = typeof clientAccountsTable.$inferSelect;
export type CustomerSession = typeof customerSessionsTable.$inferSelect;
