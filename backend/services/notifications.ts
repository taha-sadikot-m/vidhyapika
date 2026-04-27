import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getFrom(): string {
  return process.env.SMTP_FROM || `Vidhyapika <${process.env.SMTP_USER}>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL MOCK] To: ${to}\nSubject: ${subject}\n---\n${html}\n---`);
    return;
  }
  await transport.sendMail({ from: getFrom(), to, subject, html });
}

export async function sendEnrollmentNotifications(params: {
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  parentName: string;
  parentEmail?: string;
  parentPhone?: string;
  className: string;
  tempPassword: string;
}): Promise<string[]> {
  const { studentName, studentEmail, parentName, parentEmail, className, tempPassword } = params;

  const subject = `Welcome to ${className} — Vidhyapika`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#4F46E5;">Welcome to ${className}!</h2>
      <p>Dear ${studentName} and ${parentName},</p>
      <p>You have been successfully enrolled in <strong>${className}</strong> on Vidhyapika, your AI-powered math learning platform.</p>
      <h3>Login Credentials</h3>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Temporary Password</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;">${tempPassword}</td></tr>
      </table>
      <p style="color:#EF4444;"><strong>Important:</strong> You must change this password on your first login.</p>
      <p>Best regards,<br/><strong>Vidhyapika Team</strong></p>
    </div>
  `;

  const results: string[] = [];
  const targets = [
    { email: studentEmail, label: "student" },
    { email: parentEmail, label: "parent" },
  ];

  for (const { email, label } of targets) {
    if (!email) continue;
    try {
      await sendEmail(email, subject, html);
      results.push(`Enrollment email sent to ${label} (${email}).`);
    } catch (e: any) {
      results.push(`Email to ${label} failed: ${e.message}`);
    }
  }

  return results;
}

export async function sendFlaggedAlert(params: {
  adminEmail: string;
  studentName: string;
  studentEmail: string;
  topicName: string;
  subTopicName?: string;
  flagType: string;
  attemptCount: number;
}): Promise<void> {
  const { adminEmail, studentName, studentEmail, topicName, subTopicName, flagType, attemptCount } =
    params;

  const subject = `[Vidhyapika] Student Needs Attention: ${studentName}`;
  const context = subTopicName ? `Sub-topic: ${subTopicName} (in ${topicName})` : `Topic: ${topicName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#EF4444;">Student Flagged for Review</h2>
      <p>A student has been flagged after failing ${attemptCount} attempts and requires your attention.</p>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Student</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${studentName} (${studentEmail})</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Context</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${context}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Type</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${flagType}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Attempts</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${attemptCount} (all failed)</td></tr>
      </table>
      <p>Please review this student's progress in the admin portal.</p>
      <p>Best regards,<br/><strong>Vidhyapika System</strong></p>
    </div>
  `;

  await sendEmail(adminEmail, subject, html);
}

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  tempPassword: string;
}): Promise<void> {
  const { email, name, tempPassword } = params;
  const subject = "Vidhyapika — Password Reset";
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#4F46E5;">Password Reset</h2>
      <p>Hi ${name},</p>
      <p>Your password has been reset. Use the temporary password below to log in, then change it immediately.</p>
      <p style="font-family:monospace;font-size:1.2em;background:#f3f4f6;padding:12px;border-radius:6px;">${tempPassword}</p>
      <p style="color:#EF4444;"><strong>This password expires after first use.</strong></p>
      <p>Best regards,<br/><strong>Vidhyapika Team</strong></p>
    </div>
  `;
  await sendEmail(email, subject, html);
}
