import { hash, randomBytes } from 'crypto';
import { prisma } from '@/core/prisma';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  };

  return await transporter.sendMail(mailOptions);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  
  if (!user) {
    // Don't reveal if user exists
    return { success: true };
  }

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 900000); // 15 minutes

  await prisma.verificationToken.create({
    data: {
      identifier: email.toLocaleLowerCase(),
      token,
      expires,
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: `${process.env.NEXT_PUBLIC_SITE_NAME} Password Reset Request`,
    html: `
      <h2>Reset Your Password</h2>
      <p>You are receiving this email because you submitted a password reset request on <a href="${process.env.NEXTAUTH_URL}">${process.env.NEXT_PUBLIC_SITE_NAME}</a>.</p>
      <p>If this was you, click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If this was not you, you can ignore this email. The link expires in 15 minutes.</p>
    `,
  });

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    throw new Error('Invalid or expired token');
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: resetToken.identifier,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    await prisma.verificationToken.delete({ where: { token } });
    throw new Error('User not found');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await prisma.verificationToken.delete({
    where: { token },
  });

  return { success: true };
}