import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockUsers: Record<string, { password: string; isFirstLogin: boolean; role?: string; name?: string }> = {
  "student@demo.com": {
    password: "password123",
    isFirstLogin: false,
    role: "student",
    name: "Arjun (Demo Student)"
  },
  "parent@demo.com": {
    password: "password123",
    isFirstLogin: false,
    role: "parent",
    name: "Mr. Sharma (Demo Parent)"
  },
  "admin@demo.com": {
    password: "admin",
    isFirstLogin: false,
    role: "admin",
    name: "Admin User"
  }
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  const user = mockUsers[email];
  if (user) {
    if (user.password === password) {
      if (user.isFirstLogin) {
        return res.json({ success: true, requirePasswordReset: true });
      }
      return res.json({
        success: true,
        token: "mock-jwt-token",
        user: { email, name: user.name, role: user.role }
      });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Fallback for default mock login
  if (email === "student@school.edu" && password === "password") {
    return res.json({
      success: true,
      token: "mock-jwt-token",
      user: { email, name: "Default Student", role: "student" }
    });
  }

  return res.status(401).json({ error: "Invalid credentials" });
}
