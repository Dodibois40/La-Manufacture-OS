import nodemailer from 'nodemailer';

// Create transporter (lazy initialization)
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send invitation email to new team member
 * @param {string} to - Recipient email address
 * @param {string} token - Invitation token
 * @param {string} managerName - Name of the manager inviting
 * @param {string} inviteeName - Name of the person being invited
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendInvitationEmail(to, token, managerName, inviteeName) {
  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background-color: #f5f5f7;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .logo {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: 12px;
          color: #0A84FF;
          margin-bottom: 10px;
        }
        .tagline {
          font-size: 14px;
          color: #666;
          letter-spacing: 2px;
        }
        .content {
          background: white;
          padding: 40px 30px;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        h2 {
          color: #1d1d1f;
          font-size: 24px;
          margin-top: 0;
          margin-bottom: 20px;
        }
        p {
          color: #1d1d1f;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .button {
          display: inline-block;
          background: #0A84FF;
          color: white;
          padding: 16px 40px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          margin-top: 24px;
          margin-bottom: 24px;
        }
        .button:hover {
          background: #0071E3;
        }
        .note {
          font-size: 14px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e7;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          color: #666;
          font-size: 14px;
        }
        .footer a {
          color: #0A84FF;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">FLOW</div>
          <div class="tagline">LA MANUFACTURE OS</div>
        </div>
        <div class="content">
          <h2>Bonjour ${inviteeName},</h2>
          <p><strong>${managerName}</strong> vous invite à rejoindre son équipe sur <strong>La Manufacture OS</strong>.</p>
          <p>Avec votre espace membre, vous pourrez :</p>
          <ul style="color: #1d1d1f; line-height: 1.8;">
            <li>Accéder à vos projets et tâches assignés</li>
            <li>Suivre votre temps de travail</li>
            <li>Mettre à jour le statut de vos tâches</li>
            <li>Collaborer efficacement avec votre équipe</li>
          </ul>
          <center>
            <a href="${inviteUrl}" class="button">Accepter l'invitation</a>
          </center>
          <div class="note">
            Ce lien est valable pendant <strong>7 jours</strong>. Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email en toute sécurité.
          </div>
        </div>
        <div class="footer">
          <p>© 2026 La Manufacture OS - FLOW</p>
          <p>Conçu pour la productivité et la collaboration</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Bonjour ${inviteeName},

${managerName} vous invite à rejoindre son équipe sur La Manufacture OS.

Avec votre espace membre, vous pourrez :
- Accéder à vos projets et tâches assignés
- Suivre votre temps de travail
- Mettre à jour le statut de vos tâches
- Collaborer efficacement avec votre équipe

Acceptez l'invitation en cliquant sur ce lien :
${inviteUrl}

Ce lien est valable pendant 7 jours. Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email en toute sécurité.

© 2026 La Manufacture OS - FLOW
Conçu pour la productivité et la collaboration
  `;

  try {
    const info = await getTransporter().sendMail({
      from: `"FLOW - La Manufacture OS" <${process.env.SMTP_USER}>`,
      to,
      subject: `${managerName} vous invite à rejoindre son équipe sur FLOW`,
      text,
      html,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration is correct
 * @returns {Promise<boolean>}
 */
export async function verifyEmailConfig() {
  try {
    await getTransporter().verify();
    console.log('Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('Email configuration verification failed:', error);
    return false;
  }
}

/**
 * Send test email
 * @param {string} to - Test recipient email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendTestEmail(to) {
  try {
    const info = await getTransporter().sendMail({
      from: `"FLOW - La Manufacture OS" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Test Email - FLOW',
      text: 'This is a test email from La Manufacture OS.',
      html: '<p>This is a test email from <strong>La Manufacture OS</strong>.</p>',
    });

    console.log('Test email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Test email send error:', error);
    return { success: false, error: error.message };
  }
}
