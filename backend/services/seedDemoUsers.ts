import { getUserByEmail, upsertUser } from "../repositories/userRepo";
import { hashPassword } from "./auth";

export async function seedDemoUsersIfMissing() {
  const demo = [
    {
      email: "student@demo.com",
      name: "Arjun (Demo Student)",
      role: "student",
      password: "password123",
      mustResetPassword: false,
    },
    {
      email: "parent@demo.com",
      name: "Mr. Sharma (Demo Parent)",
      role: "parent",
      password: "password123",
      mustResetPassword: false,
    },
    {
      email: "admin@demo.com",
      name: "Admin User",
      role: "admin",
      password: "admin",
      mustResetPassword: false,
    },
    {
      email: "student@school.edu",
      name: "Default Student",
      role: "student",
      password: "password",
      mustResetPassword: false,
    },
  ];

  for (const u of demo) {
    const existing = await getUserByEmail(u.email);
    if (existing) continue;
    await upsertUser({
      email: u.email,
      name: u.name,
      role: u.role,
      passwordHash: await hashPassword(u.password),
      mustResetPassword: u.mustResetPassword,
    });
  }
}

