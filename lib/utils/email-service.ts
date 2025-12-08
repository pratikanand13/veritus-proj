import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    password: string
  }
}

interface PaperRecommendation {
  title: string
  tldr?: string
  pdfLink?: string
}

interface DailyPaperRecommendation {
  bookmarkTitle: string
  paperTitle: string
  tldr: string
  paperId?: string
  pdfLink?: string
}

/**
 * Create nodemailer transporter
 */
function createTransporter() {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
    },
  }

  if (!config.auth.user || !config.auth.password) {
    console.warn('SMTP credentials not configured. Email sending will fail.')
  }

  return nodemailer.createTransport(config)
}

/**
 * Send paper recommendations email to a user
 */
export async function sendPaperRecommendationsEmail(
  userEmail: string,
  userName: string,
  recommendations: PaperRecommendation[]
): Promise<void> {
  if (recommendations.length === 0) {
    console.log(`No recommendations to send for ${userEmail}`)
    return
  }

  const transporter = createTransporter()

  const emailHtml = generateEmailTemplate(userName, recommendations)

  try {
    await transporter.sendMail({
      from: `"Research Paper Recommendations" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `New Paper Recommendations - ${recommendations.length} papers`,
      html: emailHtml,
      text: generateEmailText(userName, recommendations),
    })

    console.log(`Email sent successfully to ${userEmail}`)
  } catch (error) {
    console.error(`Failed to send email to ${userEmail}:`, error)
    throw error
  }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(
  userName: string,
  recommendations: PaperRecommendation[]
): string {
  const papersHtml = recommendations
    .map(
      (paper, index) => `
    <div style="margin-bottom: 30px; padding: 20px; background-color: #1a1a1a; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <h3 style="color: #ffffff; margin-top: 0; margin-bottom: 10px; font-size: 18px;">
        ${index + 1}. ${escapeHtml(paper.title)}
      </h3>
      ${
        paper.tldr
          ? `<p style="color: #d1d5db; margin: 10px 0; font-style: italic; line-height: 1.6;">
          ${escapeHtml(paper.tldr)}
        </p>`
          : ''
      }
      ${
        paper.pdfLink
          ? `<a href="${escapeHtml(paper.pdfLink)}" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">
          View PDF
        </a>`
          : ''
      }
    </div>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paper Recommendations</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f0f; color: #ffffff; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #2a2a2a;">
      <h1 style="color: #ffffff; margin-top: 0; margin-bottom: 10px; font-size: 24px;">
        📚 New Paper Recommendations
      </h1>
      <p style="color: #9ca3af; margin: 10px 0 30px 0; font-size: 14px;">
        Hi ${escapeHtml(userName)},
      </p>
      <p style="color: #d1d5db; margin: 20px 0; line-height: 1.6;">
        Based on your bookmarked papers, we found ${recommendations.length} new paper${recommendations.length > 1 ? 's' : ''} that might interest you:
      </p>
      
      ${papersHtml}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2a;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          You're receiving this email because you have email notifications enabled for your bookmarked papers.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate plain text email
 */
function generateEmailText(
  userName: string,
  recommendations: PaperRecommendation[]
): string {
  const papersText = recommendations
    .map(
      (paper, index) => `
${index + 1}. ${paper.title}
${paper.tldr ? `   ${paper.tldr}` : ''}
${paper.pdfLink ? `   PDF: ${paper.pdfLink}` : ''}
`
    )
    .join('\n')

  return `
New Paper Recommendations

Hi ${userName},

Based on your bookmarked papers, we found ${recommendations.length} new paper${recommendations.length > 1 ? 's' : ''} that might interest you:

${papersText}

You're receiving this email because you have email notifications enabled for your bookmarked papers.
  `.trim()
}

/**
 * Send daily paper recommendation email to a user
 * Based on a single bookmark and one recommended paper
 */
export async function sendDailyPaperEmail(
  userEmail: string,
  userName: string,
  recommendation: DailyPaperRecommendation
): Promise<void> {
  if (!recommendation.tldr) {
    console.log(`No TLDR to send for ${userEmail}`)
    return
  }

  const transporter = createTransporter()

  const emailHtml = generateDailyEmailTemplate(userName, recommendation)
  const emailText = generateDailyEmailText(userName, recommendation)

  try {
    await transporter.sendMail({
      from: `"Research Paper Recommendations" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `Your daily paper: ${recommendation.paperTitle}`,
      html: emailHtml,
      text: emailText,
    })

    console.log(`Daily email sent successfully to ${userEmail}`)
  } catch (error) {
    console.error(`Failed to send daily email to ${userEmail}:`, error)
    throw error
  }
}

/**
 * Generate HTML email template for daily paper recommendation
 */
function generateDailyEmailTemplate(
  userName: string,
  recommendation: DailyPaperRecommendation
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Paper Recommendation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f0f; color: #ffffff; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #2a2a2a;">
      <h1 style="color: #ffffff; margin-top: 0; margin-bottom: 10px; font-size: 24px;">
        📚 Your Daily Paper Recommendation
      </h1>
      <p style="color: #9ca3af; margin: 10px 0 30px 0; font-size: 14px;">
        Hi ${escapeHtml(userName)},
      </p>
      <p style="color: #d1d5db; margin: 20px 0; line-height: 1.6;">
        Here's a paper recommendation based on your bookmark: <strong>${escapeHtml(recommendation.bookmarkTitle)}</strong>
      </p>
      
      <div style="margin: 30px 0; padding: 20px; background-color: #1a1a1a; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <h2 style="color: #ffffff; margin-top: 0; margin-bottom: 15px; font-size: 20px;">
          ${escapeHtml(recommendation.paperTitle)}
        </h2>
        <p style="color: #d1d5db; margin: 15px 0; font-style: italic; line-height: 1.6;">
          ${escapeHtml(recommendation.tldr)}
        </p>
        ${
          recommendation.pdfLink
            ? `<a href="${escapeHtml(recommendation.pdfLink)}" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">
          View PDF
        </a>`
            : ''
        }
        ${
          recommendation.paperId
            ? `<p style="color: #9ca3af; margin-top: 15px; font-size: 12px;">
          Paper ID: ${escapeHtml(recommendation.paperId)}
        </p>`
            : ''
        }
      </div>
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2a;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          You're receiving this email because you have daily email notifications enabled for your bookmarked papers.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate plain text email for daily paper recommendation
 */
function generateDailyEmailText(
  userName: string,
  recommendation: DailyPaperRecommendation
): string {
  return `
Your Daily Paper Recommendation

Hi ${userName},

Here's a paper recommendation based on your bookmark: ${recommendation.bookmarkTitle}

${recommendation.paperTitle}

${recommendation.tldr}

${recommendation.pdfLink ? `PDF: ${recommendation.pdfLink}` : ''}
${recommendation.paperId ? `Paper ID: ${recommendation.paperId}` : ''}

You're receiving this email because you have daily email notifications enabled for your bookmarked papers.
  `.trim()
}

/**
 * Send OTP email for signup verification
 * In development mode without SMTP, logs OTP to console instead
 */
export async function sendOTPEmail(
  userEmail: string,
  otp: string
): Promise<void> {
  // Check if SMTP is configured
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPassword = process.env.SMTP_PASSWORD?.trim()
  const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
  const smtpSecure = process.env.SMTP_SECURE === 'true'
  
  // Debug logging to check what's being read
  console.log('\n=== SMTP Configuration Check ===')
  console.log('SMTP_USER exists:', !!process.env.SMTP_USER)
  console.log('SMTP_USER value (first 3 chars):', process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 3) + '...' : 'undefined')
  console.log('SMTP_USER length:', process.env.SMTP_USER?.length || 0)
  console.log('SMTP_PASSWORD exists:', !!process.env.SMTP_PASSWORD)
  console.log('SMTP_PASSWORD length:', process.env.SMTP_PASSWORD?.length || 0)
  console.log('SMTP_HOST:', smtpHost)
  console.log('SMTP_PORT:', smtpPort)
  console.log('SMTP_SECURE:', smtpSecure)
  console.log('All SMTP env vars found:', Object.keys(process.env).filter(key => key.includes('SMTP')))
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('================================\n')
  
  // If SMTP not configured, log OTP in development mode
  if (!smtpUser || !smtpPassword) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log('\n' + '='.repeat(60))
      console.log('📧 OTP EMAIL (Development Mode - SMTP not configured)')
      console.log('='.repeat(60))
      console.log(`To: ${userEmail}`)
      console.log(`Subject: Your Verification Code`)
      console.log(`\nYour verification code is: ${otp}`)
      console.log(`\nThis code expires in 10 minutes.`)
      console.log('='.repeat(60) + '\n')
      return // Don't throw error in dev mode
    } else {
      // In production, throw error if SMTP not configured
      throw new Error('SMTP credentials not configured. Cannot send OTP email.')
    }
  }

  // Create transporter with explicit configuration
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    // Add debug option in development
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  })

  // Verify transporter configuration
  try {
    await transporter.verify()
    console.log('SMTP server is ready to send emails')
  } catch (verifyError) {
    console.error('SMTP verification failed:', verifyError)
    throw new Error(`SMTP configuration error: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`)
  }

  const emailHtml = generateOTPEmailTemplate(otp)
  const emailText = generateOTPEmailText(otp)

  try {
    const mailOptions = {
      from: `"Research Paper Platform" <${smtpUser}>`,
      to: userEmail,
      subject: 'Your Verification Code',
      html: emailHtml,
      text: emailText,
    }

    console.log(`Attempting to send OTP email to ${userEmail} via ${smtpHost}:${smtpPort}`)
    
    const info = await transporter.sendMail(mailOptions)
    
    console.log(`OTP email sent successfully to ${userEmail}`)
    console.log('Message ID:', info.messageId)
  } catch (error: any) {
    console.error(`Failed to send OTP email to ${userEmail}:`, error)
    
    // Provide more helpful error messages
    if (error.code === 'EAUTH') {
      throw new Error('SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD.')
    } else if (error.code === 'ECONNECTION') {
      throw new Error(`Could not connect to SMTP server ${smtpHost}:${smtpPort}. Please check SMTP_HOST and SMTP_PORT.`)
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('SMTP connection timed out. Please check your network connection and SMTP settings.')
    }
    
    throw error
  }
}

/**
 * Generate HTML email template for OTP
 */
function generateOTPEmailTemplate(otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f0f; color: #ffffff; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #2a2a2a;">
      <h1 style="color: #ffffff; margin-top: 0; margin-bottom: 10px; font-size: 24px;">
        🔐 Verification Code
      </h1>
      <p style="color: #9ca3af; margin: 10px 0 30px 0; font-size: 14px;">
        Please use the following code to complete your signup:
      </p>
      
      <div style="margin: 30px 0; padding: 20px; background-color: #1a1a1a; border-radius: 8px; border: 2px solid #3b82f6; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: monospace;">
          ${otp}
        </div>
      </div>
      
      <p style="color: #d1d5db; margin: 20px 0; line-height: 1.6;">
        This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
      </p>
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2a;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate plain text email for OTP
 */
function generateOTPEmailText(otp: string): string {
  return `
Verification Code

Please use the following code to complete your signup:

${otp}

This code will expire in 10 minutes. If you didn't request this code, please ignore this email.

This is an automated email. Please do not reply.
  `.trim()
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

