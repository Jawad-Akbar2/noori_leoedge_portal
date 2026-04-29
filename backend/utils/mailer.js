// utils/mailer.js
// Thin wrapper around nodemailer. Reads SMTP_* env vars.

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();


const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,   // true only for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send a password-reset email.
 * @param {string} to        - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} token     - Plain reset token
 */
export async function sendPasswordResetEmail(to, firstName, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl    = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

  await transporter.sendMail({
    from:    `"HR Portal" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Password Reset Request — HR Portal',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);
                        padding:36px 40px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                🔐 HR Portal
              </h1>
              <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">
                Employee Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">
                Hi ${firstName},
              </h2>
              <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
                We received a request to reset your password. Click the button below
                to choose a new one. This link is valid for <strong>15 minutes</strong>.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}"
                       style="background:#2563eb;color:#fff;text-decoration:none;
                              padding:14px 36px;border-radius:8px;font-size:15px;
                              font-weight:600;display:inline-block;
                              letter-spacing:0.3px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 16px;">
                If you didn't request this, you can safely ignore this email —
                your password will remain unchanged.
              </p>

              <!-- Fallback link -->
              <div style="background:#f8fafc;border-radius:8px;padding:16px;word-break:break-all;">
                <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;
                           text-transform:uppercase;letter-spacing:0.5px;">
                  Or paste this link in your browser:
                </p>
                <a href="${resetUrl}"
                   style="color:#2563eb;font-size:12px;word-break:break-all;">
                  ${resetUrl}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;
                        border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © ${new Date().getFullYear()} HR Portal. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Hi ${firstName},\n\nReset your HR Portal password here:\n${resetUrl}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, ignore this email.`
  });
}