# Cliptica Social Media Direct Publishing — Platform Approval Checklist

> **Developer & Platform Owner Guide**  
> Complete, step-by-step instructions to register developer applications, obtain production API credentials, configure OAuth redirect URIs, and pass platform app reviews for TikTok, YouTube, and Instagram direct publishing.

---

## Quick Reference: Environment Variables & Redirect URIs

| Platform | Required Environment Variables | Production OAuth Redirect URI |
|---|---|---|
| **TikTok** | `TIKTOK_CLIENT_KEY`<br>`TIKTOK_CLIENT_SECRET`<br>`NEXT_PUBLIC_TIKTOK_REDIRECT_URI` | `https://cliptica.com/api/social/tiktok/callback` |
| **YouTube** | `YOUTUBE_CLIENT_ID`<br>`YOUTUBE_CLIENT_SECRET`<br>`NEXT_PUBLIC_YOUTUBE_REDIRECT_URI` | `https://cliptica.com/api/social/youtube/callback` |
| **Instagram** | `INSTAGRAM_CLIENT_ID`<br>`INSTAGRAM_CLIENT_SECRET`<br>`NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI` | `https://cliptica.com/api/social/instagram/callback` |
| **Encryption** | `ENCRYPTION_SECRET` (32-byte secret for AES-256-GCM) | N/A (Internal secret) |

---

## 1. TikTok for Developers (Content Posting API)

### Step 1: Register Developer Account & App
1. Go to [TikTok for Developers](https://developers.tiktok.com/) and register or sign in with your corporate TikTok account.
2. Click **Manage Apps** → **Create an App**.
3. App Name: `Cliptica` (or your registered brand name).
4. App Category: `Video / Content Creation / Productivity`.
5. Upload app icon (1024x1024 PNG), Privacy Policy URL (`https://cliptica.com/privacy`), and Terms of Service URL (`https://cliptica.com/terms`).

### Step 2: Add Products & Request Scopes
Under your App Dashboard, add the **Content Posting API** product and request the following scopes:
- `user.info.basic`: Read user open_id and display name to show connected account status in Settings.
- `video.publish`: Direct publishing of completed short-form video clips to user profiles.
- `video.upload`: Upload video binaries / trigger server pull from Cloudflare R2 storage URLs.

### Step 3: Configure Redirect Domains
1. In App Settings → **Redirect Domains**, add:
   - Development / Staging: `http://localhost:3000/api/social/tiktok/callback`
   - Production: `https://cliptica.com/api/social/tiktok/callback`
2. Save changes and copy **Client Key** and **Client Secret** into your `.env.production`.

### Step 4: Sandbox & Test Accounts
1. Under **Development Mode / Sandbox**, add test TikTok creator accounts under **Testers**.
2. Testers can authenticate immediately without waiting for global app approval.

### Step 5: App Review & Screencast Submission
TikTok requires a screencast demonstrating the user journey before granting public production access:
- **Video Requirements**:
  1. Show user logging into Cliptica.
  2. Navigate to Settings → Connected Accounts & Direct Publishing.
  3. Click "Connect TikTok", redirecting to TikTok OAuth consent dialog.
  4. Show successful return to Cliptica with green "Connected as @username" status.
  5. Go to a project clip, open the "Publish" modal, select TikTok, enter hook and hashtags, and click "Publish Now".
  6. Open the TikTok app and show the published video appearing in the account feed/inbox.

---

## 2. Google Cloud Console (YouTube Data API v3)

### Step 1: Create Google Cloud Project
1. Visit [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Cliptica-Social-Publishing`.
3. Go to **APIs & Services** → **Library**, search for **YouTube Data API v3**, and click **Enable**.

### Step 2: Configure OAuth Consent Screen
1. Navigate to **APIs & Services** → **OAuth consent screen**.
2. User Type: **External**.
3. App information:
   - App name: `Cliptica`
   - User support email: your admin email
   - App domain: `https://cliptica.com`
   - Privacy Policy: `https://cliptica.com/privacy`
   - Terms of Service: `https://cliptica.com/terms`
4. Scopes to add:
   - `https://www.googleapis.com/auth/youtube.upload` (Manage YouTube videos)
   - `https://www.googleapis.com/auth/userinfo.profile` (View channel name)
5. Test users: Add the email addresses of your team and internal test channels. While in "Testing" status, these users can upload clips immediately.

### Step 3: Generate OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Cliptica Web Client`.
4. Authorized redirect URIs:
   - `http://localhost:3000/api/social/youtube/callback`
   - `https://cliptica.com/api/social/youtube/callback`
5. Copy **Client ID** and **Client Secret** into `.env.production` as `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.

### Step 4: Verification & Quotas
- Default YouTube upload quota is 10,000 units/day (each video insert costs ~1,600 units = ~6 uploads/day).
- For high-volume scaling, submit a **YouTube API Quota Increase Request** from Google Cloud Console explaining that Cliptica is an AI clipping tool publishing user-initiated shorts.

---

## 3. Meta for Developers (Instagram Graph API & Reels)

### Step 1: Create Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** → **Create App**.
3. App Type: **Business** (required for Instagram Graph API access).
4. App Name: `Cliptica Reels Publisher`.

### Step 2: Add Instagram Graph API & Facebook Login
1. In Dashboard, add **Instagram Graph API** and **Facebook Login for Business**.
2. Under Facebook Login → **Settings** → **Valid OAuth Redirect URIs**, add:
   - `http://localhost:3000/api/social/instagram/callback`
   - `https://cliptica.com/api/social/instagram/callback`

### Step 3: Required Permissions & Scopes
Request the following standard permissions:
- `instagram_basic`: Access linked Instagram Professional/Creator account IDs and usernames.
- `instagram_content_publish`: Direct creation and publishing of Instagram Reels.
- `pages_show_list`: Locate Facebook pages connected to the creator's Instagram account.
- `pages_read_engagement`: Verify active account connectivity status.

### Step 4: Test Accounts & Development Mode
1. In **App Roles** → **Roles**, add test Facebook/Instagram Creator accounts as Developers or Testers.
2. Ensure test Instagram accounts are converted to **Professional / Creator accounts** and linked to a Facebook Page (Meta Graph API requirement for Reels).

### Step 5: App Review Submission
- Meta requires business verification and a screencast recording showing:
  1. The Facebook Login popup asking for permissions.
  2. The linked Instagram account appearing in Cliptica Settings.
  3. The clip publishing modal sending the video to Instagram.
  4. The Reel appearing in the Instagram profile feed.

---

## 4. Verification Checklist Before Production Launch

- [ ] All 3 redirect URIs added to developer portals under exact HTTPS domain.
- [ ] `ENCRYPTION_SECRET` generated via `openssl rand -base64 32` and added to production `.env.production`.
- [ ] Prisma schema synchronized with Neon DB: `SocialConnection` and `SocialPublishLog` tables exist.
- [ ] At least one test account authenticated for each platform in development mode.
- [ ] Screencast recorded for TikTok and Meta app review submissions.
- [ ] Privacy Policy and Terms of Service URLs verified live on public domain.
