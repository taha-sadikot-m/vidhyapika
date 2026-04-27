import { Router } from "express";
import { z } from "zod";
import { hashPassword } from "../services/auth";
import { sendEnrollmentNotifications } from "../services/notifications";
import { upsertUser } from "../repositories/userRepo";

const NotifyStudentSchema = z.object({
  studentName: z.string().min(1),
  studentEmail: z.string().email().optional().or(z.literal("")),
  studentPhone: z.string().optional().or(z.literal("")),
  parentName: z.string().min(1),
  parentEmail: z.string().email().optional().or(z.literal("")),
  parentPhone: z.string().optional().or(z.literal("")),
  className: z.string().min(1),
});

function generateTempPassword() {
  return Math.random().toString(36).slice(-8);
}

export function notifyRoutes() {
  const r = Router();

  r.post("/notify-student", async (req, res, next) => {
    try {
      const body = NotifyStudentSchema.parse(req.body);
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Create/update accounts for student + parent; they must reset password on first login.
      if (body.studentEmail) {
        await upsertUser({
          email: body.studentEmail,
          name: body.studentName,
          role: "student",
          passwordHash,
          mustResetPassword: true,
        });
      }
      if (body.parentEmail) {
        await upsertUser({
          email: body.parentEmail,
          name: body.parentName,
          role: "parent",
          passwordHash,
          mustResetPassword: true,
        });
      }

      const notifications = await sendEnrollmentNotifications({
        studentName: body.studentName,
        studentEmail: body.studentEmail || undefined,
        studentPhone: body.studentPhone || undefined,
        parentName: body.parentName,
        parentEmail: body.parentEmail || undefined,
        parentPhone: body.parentPhone || undefined,
        className: body.className,
        tempPassword,
      });

      res.json({ success: true, notifications });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

