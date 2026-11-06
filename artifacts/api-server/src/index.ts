import { ensureDatabaseSchema } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort =
  process.env["PORT"] ||
  process.env["FINJOY_ADMIN_PORT"] ||
  process.env["FINJOY_API_PORT"] ||
  "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    logger.error({ err }, "Failed to initialize database schema");
    process.exit(1);
  }

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "FinJoy unified server (Web + API) listening");
  });
}

void main();
