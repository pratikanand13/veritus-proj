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

