import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      device_model TEXT NOT NULL,
      device_imei TEXT,
      total_amount NUMERIC(12, 2) NOT NULL,
      paid_amount NUMERIC(12, 2) DEFAULT '0' NOT NULL,
      monthly_payment NUMERIC(12, 2) NOT NULL,
      next_due_date TIMESTAMP NOT NULL,
      start_date TIMESTAMP NOT NULL,
      total_months INTEGER NOT NULL,
      paid_months INTEGER DEFAULT 0 NOT NULL,
      grace_period_days INTEGER DEFAULT 3 NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL,
      date TIMESTAMP NOT NULL,
      method TEXT NOT NULL,
      reference TEXT NOT NULL,
      status TEXT DEFAULT 'completed' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS apk_versions (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      file_name TEXT NOT NULL,
      object_path TEXT NOT NULL,
      size INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      checksum TEXT NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      published_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_accounts (
      client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      password_hash TEXT,
      activation_code_hash TEXT,
      activation_code_expires_at TIMESTAMP,
      activated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_sessions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS customer_sessions_token_hash_idx
      ON customer_sessions (token_hash);

    CREATE TABLE IF NOT EXISTS customer_devices (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
      device_id_hash TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT NOT NULL,
      os_version TEXT,
      device_admin_active BOOLEAN DEFAULT FALSE NOT NULL,
      device_owner BOOLEAN DEFAULT FALSE NOT NULL,
      first_seen_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_seen_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS customer_devices_device_id_hash_idx
      ON customer_devices (device_id_hash);

    ALTER TABLE customer_devices
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS location_accuracy DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP;
  `);
}

export * from "./schema";
