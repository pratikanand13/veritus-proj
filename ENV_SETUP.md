# Environment Variables Setup Guide

## Important: Restart Required

**⚠️ CRITICAL:** After adding or modifying environment variables in `.env.local`, you **MUST restart your Next.js development server** for the changes to take effect.

```bash
# Stop the server (Ctrl+C) and restart:
npm run dev
```

## SMTP Configuration for OTP Emails

Add these variables to your `.env.local` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Common Issues:

1. **Variables not loading?**
   - ✅ Make sure the file is named `.env.local` (not `.env` or `.env.local.txt`)
   - ✅ Make sure there are NO spaces around the `=` sign: `SMTP_USER=value` (not `SMTP_USER = value`)
   - ✅ Make sure there are NO quotes around values: `SMTP_USER=email@gmail.com` (not `SMTP_USER="email@gmail.com"`)
   - ✅ Restart your dev server after adding variables

2. **Gmail Setup:**
   - Use an **App Password**, not your regular Gmail password
   - Generate at: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Use the 16-character password (remove spaces if any)

3. **Checking if variables are loaded:**
   - Look for the debug output in your console when sending OTP
   - It will show which SMTP variables are found
   - If variables show as `undefined` or length `0`, they're not loaded

## Example .env.local file:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/academic-dashboard

# JWT
JWT_SECRET=your-secret-key-change-in-production

# SMTP (for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop

# Veritus API (optional)
VERITUS_API_KEY=your-api-key

# Cron (optional)
CRON_SECRET=your-cron-secret
```

## Verification

After setting up, try sending an OTP. You should see in the console:
- `SMTP_USER exists: true`
- `SMTP_PASSWORD exists: true`
- `SMTP server is ready to send emails`

If you see "SMTP not configured", check:
1. Variables are in `.env.local`
2. No typos in variable names
3. Dev server was restarted after adding variables

