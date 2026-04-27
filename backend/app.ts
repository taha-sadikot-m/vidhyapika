import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";
import { getEnv } from "./config/env";
import { authRoutes, loginHandler, resetPasswordHandler } from "./routes/authRoutes";

export async function createApiApp() {
  const env = getEnv();

  const app = express();
  app.disable("x-powered-by");

  app.use(cors({ origin: true, credentials: true }));
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: env.NODE_ENV === "production" ? 120 : 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(pinoHttp({ redact: ["req.headers.authorization"] }));

  app.get("/api/healthz", (_req, res) => res.json({ ok: true }));
  app.get("/api/readyz", (_req, res) => res.json({ ready: true }));

  app.use("/api/auth", authRoutes());

  // Backwards-compatible routes
  app.post("/api/login", loginHandler);
  app.post("/api/reset-password", resetPasswordHandler);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status >= 500 ? "Internal server error" : err?.message ?? "Request failed";
    return res.status(status).json({ error: message });
  });

  return app;
}
