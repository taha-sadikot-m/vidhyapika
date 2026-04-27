import { z } from "zod";
import { hashPassword } from "../../../../backend/services/auth";
import { sendEnrollmentNotifications } from "../../../../backend/services/notifications";
import { upsertUser } from "../../../../backend/repositories/userRepo";

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

export async function POST(req: Request) {
  try {
    const body = NotifyStudentSchema.parse(await req.json());
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

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

    return Response.json({ success: true, notifications });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

