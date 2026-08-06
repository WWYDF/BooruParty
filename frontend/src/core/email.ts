import { randomInt } from 'crypto';
import { prisma } from '@/core/prisma';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const useMailgun = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

const mailgunClient = useMailgun
  ? new Mailgun(FormData).client({ username: 'api', key: process.env.MAILGUN_API_KEY! })
  : null;

const transporter = useMailgun
  ? null
  : nodemailer.createTransport({
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
  if (mailgunClient) {
    // mailgun.js's types require statically knowing text/html/template is present;
    // both are optional here since callers may pass either.
    return await mailgunClient.messages.create(process.env.MAILGUN_DOMAIN!, {
      from: process.env.MAILGUN_FROM,
      to,
      subject,
      text,
      html,
    } as Parameters<typeof mailgunClient.messages.create>[1]);
  }

  return await transporter!.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  
  if (!user) {
    // Don't reveal if user exists
    return { success: true };
  }

  const identifier = email.toLowerCase();

  const existing = await prisma.verificationToken.findFirst({ where: { identifier } });
  if (existing && existing.createdAt.getTime() > Date.now() - 60_000) {
    // Don't spam another code out within the cooldown window
    return { success: true };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expires = new Date(Date.now() + 600_000);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      code,
      expires,
    },
  });

  await sendEmail({
    to: email,
    subject: `${process.env.NEXT_PUBLIC_SITE_NAME} Password Reset Request`,
    html: `
      <h2>Reset Your Password</h2>
      <p>You are receiving this email because you submitted a password reset request on <b>${process.env.NEXT_PUBLIC_SITE_NAME}</b>.</p>
      <p>Enter this code to reset your password:</p>
      <p style="font-size: 1.5em; font-weight: bold; letter-spacing: 0.2em; font-family: monospace;">${code}</p>
      <p>If this was not you, you can ignore this email. The code expires in 10 minutes.</p>
    `,
  });

  return { success: true };
}

async function validateResetCode(identifier: string, code: string) {
  const resetToken = await prisma.verificationToken.findFirst({ where: { identifier } });

  if (!resetToken || resetToken.expires < new Date()) {
    throw new Error('Invalid or expired code');
  }

  if (resetToken.attempts >= 5) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    throw new Error('Too many attempts. Request a new code.');
  }

  if (resetToken.code !== code) {
    await prisma.verificationToken.update({
      where: { identifier_code: { identifier, code: resetToken.code } },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid or expired code');
  }

  return resetToken;
}

export async function verifyResetCode(email: string, code: string) {
  await validateResetCode(email.toLowerCase(), code);
  return { valid: true };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const identifier = email.toLowerCase();
  await validateResetCode(identifier, code);

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: identifier,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    throw new Error('User not found');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await prisma.verificationToken.deleteMany({ where: { identifier } });

  return { success: true };
}