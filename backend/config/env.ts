import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default("vidhyapika"),
  JWT_AUDIENCE: z.string().min(1).default("vidhyapika-web"),

  // SMTP (Gmail)
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // AI (server-side only)
  GEMINI_API_KEY: z.string().optional(),

  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_LOGIN_EMAIL: z.string().email().optional(),
  ADMIN_LOGIN_PASSWORD: z.string().min(8).optional(),
  // Back-compat: if you already use ADMIN_PASSWORD for admin portal login
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(processEnv: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(processEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

