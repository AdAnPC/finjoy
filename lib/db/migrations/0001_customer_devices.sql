CREATE TABLE IF NOT EXISTS customer_devices (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  loan_id integer REFERENCES loans(id) ON DELETE SET NULL,
  device_id_hash text NOT NULL,
  manufacturer text,
  model text NOT NULL,
  os_version text,
  device_admin_active boolean NOT NULL DEFAULT false,
  device_owner boolean NOT NULL DEFAULT false,
  first_seen_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_devices_device_id_hash_idx
  ON customer_devices (device_id_hash);
