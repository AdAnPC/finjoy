import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const candidateWebDirs = [
  typeof __dirname === "string"
    ? path.resolve(__dirname, "../../admin-panel/dist/public")
    : "",
  path.resolve(process.cwd(), "artifacts/admin-panel/dist/public"),
  path.resolve(process.cwd(), "../admin-panel/dist/public"),
].filter(Boolean);

const webDistDir = candidateWebDirs.find((dir) =>
  fs.existsSync(path.join(dir, "index.html")),
);

if (webDistDir) {
  const indexHtmlPath = path.join(webDistDir, "index.html");
  app.use(express.static(webDistDir));
  app.use("/admin-panel", express.static(webDistDir));
  app.use((req, res, next) => {
    if (
      (req.method !== "GET" && req.method !== "HEAD") ||
      req.path.startsWith("/api/") ||
      req.path === "/api"
    ) {
      next();
      return;
    }
    res.sendFile(indexHtmlPath);
  });
}

export default app;
