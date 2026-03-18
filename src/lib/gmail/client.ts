import { google } from 'googleapis'

// =============================================
// Cliente Gmail con OAuth2
// Los tokens se configuran como env vars.
// Ver docs/GMAIL_SETUP.md para obtenerlos.
// =============================================

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

// Encode a mime message to base64url (formato que espera Gmail API)
function encodeMime(to: string, subject: string, html: string): string {
  const from = `${process.env.GMAIL_FROM_NAME} <${process.env.GMAIL_FROM_EMAIL}>`
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

interface SendMailOptions {
  to: string
  subject: string
  html: string
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
  const gmail = getGmailClient()
  const raw = encodeMime(to, subject, html)

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })

  return response.data
}
