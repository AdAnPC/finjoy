import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { loansTable } from "./loans";

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

export const customerDevicesTable = pgTable(
  "customer_devices",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    loanId: integer("loan_id").references(() => loansTable.id, { onDelete: "set null" }),
    deviceIdHash: text("device_id_hash").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model").notNull(),
    osVersion: text("os_version"),
    deviceAdminActive: boolean("device_admin_active").notNull().default(false),
    deviceOwner: boolean("device_owner").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("customer_devices_device_id_hash_idx").on(table.deviceIdHash)],
);

export type ClientAccount = typeof clientAccountsTable.$inferSelect;
export type CustomerSession = typeof customerSessionsTable.$inferSelect;
export type CustomerDevice = typeof customerDevicesTable.$inferSelect;
