const nodemailer = require('nodemailer');

const missingSmtpMessage = 'Email service is not configured. Add SMTP settings to send password reset emails.';

const isPlaceholder = (value = '') => /replace_|your_|example\.com|app_password/i.test(value);

const smtpConfigProblem = () => {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    return `${missingSmtpMessage} Missing: ${missing.join(', ')}.`;
  }

  if (isPlaceholder(process.env.SMTP_PASS)) {
    return 'SMTP_PASS still looks like a placeholder. Generate a real Gmail App Password and add it to backend/.env.';
  }

  return '';
};

const hasSmtpConfig = () => !smtpConfigProblem();

const createTransporter = () => {
  if (!hasSmtpConfig()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const text = [
    'We received a request to reset your password.',
    '',
    `Open this link to choose a new password: ${resetUrl}`,
    '',
    'This link expires in 1 hour. If you did not request this, you can ignore this email.'
  ].join('\n');

  if (!transporter) {
    return {
      delivered: false,
      message: smtpConfigProblem() || missingSmtpMessage
    };
  }

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    text,
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `
  });

  return { delivered: true };
};

module.exports = { hasSmtpConfig, sendPasswordResetEmail, smtpConfigProblem };
