# Daily Email Notification Cron Setup

This document describes how to set up the daily email notification cron job that runs at 4:30 AM IST.

## Overview

The cron job sends daily paper recommendations to users based on their bookmarks:
- Runs daily at **4:30 AM IST** (11:00 PM UTC previous day)
- Selects one bookmark per user
- Uses top 5 keywords from that bookmark
- Calls combined search API
- Sends one email per user per day with TL;DR from search results
- Prevents duplicate emails using `lastEmailSentDate` tracking

## Timezone Conversion

- **IST (Indian Standard Time)**: UTC + 5:30
- **4:30 AM IST** = **11:00 PM UTC** (previous day)

## Setup Options

### Option 1: Vercel Cron Jobs (Recommended for Vercel deployments)

Add to `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/bookmark-notifications",
      "schedule": "0 23 * * *"
    }
  ]
}
```

This runs at 11:00 PM UTC (4:30 AM IST next day).

**Note**: Vercel Cron Jobs require a paid plan (Pro or higher).

### Option 2: GitHub Actions (Free)

Create `.github/workflows/daily-email-cron.yml`:

```yaml
name: Daily Email Notifications

on:
  schedule:
    # Runs at 11:00 PM UTC (4:30 AM IST next day)
    - cron: '0 23 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  send-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Endpoint
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/bookmark-notifications
```

Set `CRON_SECRET` in GitHub Secrets.

### Option 3: External Cron Service

Use services like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Cronitor](https://cronitor.io)

**Configuration**:
- **URL**: `https://your-domain.com/api/cron/bookmark-notifications`
- **Method**: POST
- **Schedule**: `0 23 * * *` (11:00 PM UTC) or use timezone-aware scheduler set to 4:30 AM IST
- **Headers**: 
  ```
  Authorization: Bearer YOUR_CRON_SECRET
  ```

### Option 4: Server Cron (Self-hosted)

If running on your own server, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 11:00 PM UTC = 4:30 AM IST)
0 23 * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/bookmark-notifications
```

## Environment Variables

Set these in your environment:

```bash
# Required for cron authentication
CRON_SECRET=your-secret-token-here

# Required for email sending
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Testing

### Manual Testing

You can manually trigger the cron job:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/bookmark-notifications
```

Or use the GET endpoint to check status:

```bash
curl https://your-domain.com/api/cron/bookmark-notifications
```

### Local Testing

For local development, you can call the endpoint directly:

```bash
# Without auth (if CRON_SECRET is not set)
curl -X POST http://localhost:3000/api/cron/bookmark-notifications
```

## How It Works

1. **Eligibility Check**: Only processes users where `emailNotificationsEnabled === true`
2. **Daily Check**: Checks `lastEmailSentDate` to ensure only one email per day
3. **Bookmark Selection**: Selects one bookmark (first bookmark with keywords)
4. **Keyword Extraction**: Gets top 5 keywords from selected bookmark
5. **Search**: Calls combined search API with keywords
6. **Email**: Sends email with TL;DR from search result
7. **Tracking**: Updates `lastEmailSentDate` to prevent duplicates

## Database Schema

The `User` model includes:
- `emailNotificationsEnabled`: Boolean flag
- `bookmarks`: Array of bookmarks with keywords
- `lastEmailSentDate`: Date tracking for daily emails
- `emailNotificationHistory`: Array of sent email records

## Monitoring

Check logs for:
- Number of users processed
- Success/failure of email sends
- API errors from combined search
- Duplicate email prevention

## Troubleshooting

### Emails not sending
- Check SMTP credentials
- Verify `emailNotificationsEnabled` is true
- Check user has bookmarks with keywords

### Duplicate emails
- Verify `lastEmailSentDate` is being updated
- Check timezone handling in `wasEmailSentToday()`

### API errors
- Check Veritus API key is valid
- Verify rate limiting isn't exceeded
- Check job polling timeout

## Cron Expression Reference

- `0 23 * * *` = 11:00 PM UTC daily (4:30 AM IST next day)
- `30 4 * * *` = 4:30 AM UTC daily (10:00 AM IST same day) - **NOT CORRECT**
- Use timezone-aware schedulers when possible

