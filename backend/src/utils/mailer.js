// Envio de e-mail transacional (recuperação de senha).
//
// Sem SMTP não há entrega real. Tokens de recuperação nunca são escritos no log.

const nodemailer = require('nodemailer');
const env = require('../config/env');

function isSmtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.password);
}

let transporter = null;
function getTransporter() {
  if (!transporter && isSmtpConfigured()) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.password },
    });
  }
  return transporter;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const subject = 'Recuperação de senha — AgroTech';
  const text = `Recebemos uma solicitação para redefinir sua senha.\n\n` +
    `Clique no link abaixo para criar uma nova senha (válido por tempo limitado):\n${resetUrl}\n\n` +
    `Se você não solicitou isso, ignore este e-mail.`;
  const html = `
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    <p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a> (o link expira em breve).</p>
    <p>Se você não solicitou isso, ignore este e-mail com segurança.</p>
  `;

  if (!isSmtpConfigured()) {
    if (env.isProduction) throw new Error('SMTP não configurado.');
    // Em desenvolvimento, entrega indisponível sem expor tokens em logs.
    console.warn('[mailer] SMTP não configurado: nenhum e-mail foi enviado.');
    return { simulated: true };
  }

  const tx = getTransporter();
  await tx.sendMail({ from: env.smtp.from, to: toEmail, subject, text, html });
  return { simulated: false };
}

module.exports = { sendPasswordResetEmail, isSmtpConfigured };
