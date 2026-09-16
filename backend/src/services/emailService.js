import nodemailer from 'nodemailer'

let transporter = null

const getMissingSmtpConfig = () => {
  const requiredKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
  return requiredKeys.filter((key) => !process.env[key] || String(process.env[key]).trim() === '')
}

export const initializeEmailService = () => {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD
  const smtpFrom = process.env.SMTP_FROM
  const missing = getMissingSmtpConfig()

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom) {
    console.warn('[Daily Email] SMTP configuration incomplete. Missing environment variables:', missing)
    console.warn('[Daily Email] Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in backend/.env')
    return false
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: smtpPort === '465',
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  })

  console.log('[Daily Email] Email service initialized successfully')
  return true
}

export const sendEmailWithAttachment = async (options) => {
  const { to, cc, subject, text, html, attachments } = options
  const missing = getMissingSmtpConfig()

  if (!transporter || missing.length > 0) {
    const errorMessage = missing.length > 0
      ? `[Daily Email] SMTP not configured. Missing environment variables: ${missing.join(', ')}`
      : '[Daily Email] Email service not initialized. Configure SMTP settings in backend/.env'
    console.error(errorMessage)
    throw new Error(errorMessage)
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@example.com',
    to,
    cc: cc && cc.length > 0 ? cc : undefined,
    subject,
    text,
    html: html || text,
    attachments: attachments || [],
  }

  try {
    console.log(`[Daily Email] Connecting to email server for recipient: ${to}`)
    const result = await transporter.sendMail(mailOptions)
    console.log(`[Daily Email] Email accepted by provider. MessageId: ${result.messageId}`)
    return result
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown SMTP error'
    console.error('[Daily Email] Email sending failed:', message)
    throw new Error(message)
  }
}

export const testEmailConnection = async (testEmail) => {
  const missing = getMissingSmtpConfig()

  if (!transporter || missing.length > 0) {
    const errorMessage = missing.length > 0
      ? `[Daily Email] SMTP not configured. Missing environment variables: ${missing.join(', ')}`
      : '[Daily Email] Email service not initialized'
    console.error(errorMessage)
    throw new Error(errorMessage)
  }

  try {
    console.log(`[Daily Email] Verifying SMTP connection for ${testEmail}`)
    await transporter.verify()
    console.log('[Daily Email] SMTP connection successful')

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: testEmail,
      subject: 'Test Email - 3Vikram CRM Daily Stock Email',
      text: 'This is a test email to verify the email configuration works correctly.',
      html: '<p>This is a test email to verify the email configuration works correctly.</p>',
    })

    console.log(`[Daily Email] Test email accepted by provider for ${testEmail}. MessageId: ${result.messageId}`)
    return true
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown SMTP verification error'
    console.error('[Daily Email] Email test failed:', message)
    throw new Error(message)
  }
}
