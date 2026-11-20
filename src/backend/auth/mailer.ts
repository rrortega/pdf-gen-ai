import type { PasswordResetMailer } from "../auth-contracts";

/**
 * No-op/logging adapter used when no SMTP configuration exists. It records
 * that a reset was requested but NEVER logs the reset URL or its secret, and
 * never touches the network — tests always use this adapter.
 */
export function createLoggingMailer(log: (...parts: unknown[]) => void = console.log): PasswordResetMailer & { kind: "logging" } {
  return {
    kind: "logging",
    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
      // The reset URL carries the single-use secret: it is never logged.
      void resetUrl;
      log(
        `[AUTH] Password reset requested for ${to}; SMTP is not configured ` +
          "(set SMTP_HOST to deliver reset links). Reset links are never logged.",
      );
    },
  };
}

/**
 * SMTP adapter. nodemailer is imported lazily inside send so importing or
 * resolving this adapter never opens a connection.
 */
function createSmtpMailer(env: Record<string, string | undefined>): PasswordResetMailer & { kind: "smtp" } {
  return {
    kind: "smtp",
    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === "true",
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });

      await transport.sendMail({
        from: env.MAIL_FROM || "PDF4IA <no-reply@localhost>",
        to,
        subject: "Reset your password",
        text: `Use this link to reset your password (it expires soon and can be used once):\n\n${resetUrl}\n`,
        html:
          '<p>Use this link to reset your password (it expires soon and can be used once):</p>' +
          `<p><a href="${resetUrl}">Reset password</a></p>`,
      });
    },
  };
}

/** Environment variable names (values are never read at import time). */
export type MailerEnvironment = Record<string, string | undefined>;

/**
 * Resolves the password-reset mailer: SMTP when SMTP_HOST is configured,
 * otherwise the offline logging adapter.
 */
export function resolveMailer(env: MailerEnvironment = process.env): PasswordResetMailer & { kind: "logging" | "smtp" } {
  if (env.SMTP_HOST) {
    return createSmtpMailer(env);
  }
  return createLoggingMailer();
}
