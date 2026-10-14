import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apkVersionsTable = pgTable("apk_versions", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  checksum: text("checksum").notNull(),
  status: text("status", { enum: ["pending", "active", "archived"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
});

export const insertApkVersionSchema = createInsertSchema(apkVersionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertApkVersion = z.infer<typeof insertApkVersionSchema>;
export type ApkVersion = typeof apkVersionsTable.$inferSelect;