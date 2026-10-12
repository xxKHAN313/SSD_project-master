/**
 * emailService.ts
 *
 * email delivery service using nodemailer.
 * all email operations are fire-and-forget in terms of application flow —
 * email failures are logged but do not throw to the caller.
 * this prevents email delivery issues from blocking critical operations like password reset.
 */

import nodemailer from 'nodemailer';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * creates and returns a nodemailer transporter configured from environment variables.
 * the transporter is created lazily to allow the app to start without a valid smtp config.
 */
function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    // use TLS for ports 465 (implicit) and STARTTLS for 587 (explicit)
    secure: env.email.port === 465,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
    // connection timeout — prevent hanging if smtp is unreachable
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });
}

/**
 * sends a password reset email with a time-limited reset link.
 * the raw token is embedded in the link; the hash is stored in the DB.
 * the link expires in 1 hour (enforced at the DB level).
 *
 * on failure: logs the error and resolves (does not throw).
 * the caller should still show a "reset email sent" message to prevent
 * user enumeration (whether or not the user exists / email sends).
 *
 * @param email - the recipient email address (plaintext)
 * @param resetToken - the raw reset token (to embed in link)
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions: nodemailer.SendMailOptions = {
    from: env.email.from,
    to: email,
    subject: 'Shield-Chat: Password Reset Request',
    text: `
You requested a password reset for your Shield-Chat account.

Click the link below to reset your password (valid for 1 hour):

${resetUrl}

If you did not request this, please ignore this email and your password will remain unchanged.

For security: this link is single-use and expires in 1 hour.

— Shield-Chat Security Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Password Reset Request</h2>
  <p>You requested a password reset for your <strong>Shield-Chat</strong> account.</p>
  <p>Click the button below to reset your password:</p>
  <a href="${resetUrl}"
     style="display: inline-block; padding: 12px 24px; background-color: #2563eb;
            color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
    Reset Password
  </a>
  <p style="color: #666; font-size: 14px;">
    This link is valid for <strong>1 hour</strong> and can only be used once.
  </p>
  <p style="color: #666; font-size: 14px;">
    If you did not request this, you can safely ignore this email.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">Shield-Chat Security Team</p>
</body>
</html>
    `.trim(),
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    logger.info('[emailService] password reset email sent', {
      to: email.substring(0, 3) + '***', // partial log — don't log full email
    });
  } catch (error) {
    // log but do not propagate — email failure should not expose user existence
    logger.error('[emailService] failed to send password reset email', {
      error: (error as Error).message,
    });
  }
}

/**
 * sends a welcome email to a newly registered user.
 * purely informational — failure is non-critical.
 *
 * @param email - the recipient email address (plaintext)
 * @param username - the user's chosen username
 */
export async function sendWelcomeEmail(email: string, username: string): Promise<void> {
  const mailOptions: nodemailer.SendMailOptions = {
    from: env.email.from,
    to: email,
    subject: 'Welcome to Shield-Chat',
    text: `
Hello ${username},

Welcome to Shield-Chat — your secure messaging portal.

Your account has been created successfully. You can log in at:
${env.frontendUrl}/login

Security reminders:
- Never share your password with anyone
- Always log out when using shared computers
- Contact your administrator if you notice suspicious activity

— Shield-Chat Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Welcome to Shield-Chat</h2>
  <p>Hello <strong>${username}</strong>,</p>
  <p>Your Shield-Chat account has been created successfully.</p>
  <a href="${env.frontendUrl}/login"
     style="display: inline-block; padding: 12px 24px; background-color: #2563eb;
            color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
    Log In Now
  </a>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 4px; margin-top: 16px;">
    <h4 style="margin: 0 0 8px 0;">Security Reminders</h4>
    <ul style="margin: 0; padding-left: 20px; color: #555;">
      <li>Never share your password with anyone</li>
      <li>Always log out when using shared computers</li>
      <li>Contact your administrator if you notice suspicious activity</li>
    </ul>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">Shield-Chat Team</p>
</body>
</html>
    `.trim(),
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    logger.info('[emailService] welcome email sent', { username });
  } catch (error) {
    logger.error('[emailService] failed to send welcome email', {
      error: (error as Error).message,
      username,
    });
  }
}
