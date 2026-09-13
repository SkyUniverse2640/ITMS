import "server-only";

import nodemailer from "nodemailer";
import prisma from "@/lib/db";

interface SmtpConfig {
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const setting = await prisma.settings.findUnique({ where: { key: "smtp" } });
  if (!setting?.value) return null;
  const cfg = setting.value as unknown as SmtpConfig;
  if (!cfg.host || !cfg.port) return null;
  return cfg;
}

function createTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port, 10),
    secure: cfg.secure,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth:
      cfg.username && cfg.password
        ? { user: cfg.username, pass: cfg.password }
        : undefined,
  });
}

export async function testSmtpConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const cfg = await getSmtpConfig();
  if (!cfg) return { success: false, error: "SMTP not configured" };
  try {
    const transport = createTransport(cfg);
    await transport.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const cfg = await getSmtpConfig();
  if (!cfg) return false;
  try {
    const transport = createTransport(cfg);
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (err) {
    console.error("sendEmail failed:", err);
    return false;
  }
}
