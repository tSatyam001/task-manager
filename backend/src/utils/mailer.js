const nodemailer = require('nodemailer');

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

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

const sendOtpEmail = async ({ to, otp, subject, purpose }) => {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const text = `Your ${purpose} OTP is ${otp}. It expires in 10 minutes.`;

  if (!transporter) {
    console.log(`[OTP email disabled] ${to}: ${text}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  return { delivered: true };
};

module.exports = { sendOtpEmail };
