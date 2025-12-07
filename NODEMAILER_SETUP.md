# Nodemailer Configuration Guide

## Environment Variables Required

Add these environment variables to your `.env.local` file (for local development) or your deployment platform's environment variables (Vercel, etc.):

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Optional: Cron Job Secret (for securing the cron endpoint)
CRON_SECRET=your-secret-token-here
```

## Gmail Setup (Most Common)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication

### Step 2: Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (Custom name)"
3. Enter "Research Dashboard" as the name
4. Click "Generate"
5. Copy the 16-character password (use this as `SMTP_PASSWORD`)

### Step 3: Configure Environment Variables
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # The 16-character app password
```

## Other Email Providers

### Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

### Custom SMTP Server
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587  # or 465 for SSL
SMTP_SECURE=false  # true for port 465, false for port 587
SMTP_USER=your-username
SMTP_PASSWORD=your-password
```

## Testing Email Configuration

You can test the email configuration by calling the cron endpoint manually:

```bash
# Using curl
curl -X POST http://localhost:3000/api/cron/bookmark-notifications \
  -H "Authorization: Bearer your-cron-secret"

# Or using the GET endpoint for info
curl http://localhost:3000/api/cron/bookmark-notifications
```

## Nodemailer API Reference

The application uses the following Nodemailer APIs:

### `nodemailer.createTransport(config)`
Creates a transporter instance for sending emails.

**Config Object:**
- `host`: SMTP server hostname
- `port`: SMTP server port (587 for TLS, 465 for SSL)
- `secure`: Boolean - true for SSL (port 465), false for TLS (port 587)
- `auth`: Object with `user` and `password`

### `transporter.sendMail(options)`
Sends an email.

**Options Object:**
- `from`: Sender email address
- `to`: Recipient email address
- `subject`: Email subject
- `html`: HTML email body
- `text`: Plain text email body (optional)

### Example Usage
```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },
})

await transporter.sendMail({
  from: `"Research Paper Recommendations" <${process.env.SMTP_USER}>`,
  to: userEmail,
  subject: 'New Paper Recommendations',
  html: emailHtml,
  text: emailText,
})
```

## Troubleshooting

### "Invalid login" error
- Check that `SMTP_USER` and `SMTP_PASSWORD` are correct
- For Gmail, ensure you're using an App Password, not your regular password
- Verify 2FA is enabled if using Gmail

### "Connection timeout" error
- Check firewall settings
- Verify `SMTP_HOST` and `SMTP_PORT` are correct
- Try using port 465 with `SMTP_SECURE=true`

### "Email not received"
- Check spam/junk folder
- Verify recipient email is correct
- Check email service logs for delivery status
