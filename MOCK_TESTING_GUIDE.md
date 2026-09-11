# Cliptica Social Media Direct Publishing — Mock Testing Guide

> **Developer & QA Guide**  
> How to test the complete direct publishing pipeline locally or on staging before official platform app approvals.

---

## 1. Automated Unit & Integration Tests

The test suite in `tests/social-publish.test.ts` provides complete test coverage of all cryptographic, validation, and API adapter layers with 100% mocked external dependencies:

```bash
# Run the social publishing test suite
npx vitest run tests/social-publish.test.ts
```

### What is tested:
1. **AES-256-GCM Encryption / Decryption**:
   - Encrypts and decrypts OAuth tokens.
   - Verifies random IV generation (no two ciphertexts are identical for the same token).
   - Verifies authentication tag failure when decrypted with an incorrect secret.
   - Detects malformed ciphertexts.
2. **HMAC-SHA256 OAuth State**:
   - Generates tamper-proof state tokens with embedded timestamps.
   - Rejects forged or modified signatures.
   - Rejects expired state tokens older than 15 minutes.
3. **Graceful Credential Absence**:
   - Verifies that `/connect` and discovery endpoints never crash when credentials are unset in `.env`.
   - Confirms clear `{ error: 'not_configured' }` JSON response with missing variable names.
4. **Format & Duration Validation**:
   - Rejects missing media URLs.
   - Enforces TikTok duration bounds (3s - 600s).
   - Enforces YouTube Shorts 60s advisory.
   - Enforces Instagram Reels vertical requirement (9:16) and 90s ceiling.
5. **Platform Mock Publishing**:
   - Mocks TikTok Content Posting API (`/v2/post/publish/video/init/`).
   - Mocks YouTube resumable upload session and byte streaming.
   - Mocks Instagram 3-step Reels container creation, readiness polling, and publish.
6. **Token Auto-Refresh**:
   - Tests automatic refresh grant for TikTok, YouTube, and Meta.

---

## 2. End-to-End Local Mocking (Without Real API Keys)

To test the full UI flow locally (Settings connection status, clip publish modal, and database recording) without waiting for platform developer approvals:

### Step 1: Set Dummy Developer Credentials in `.env.local`

Add mock credentials to your `.env.local`:

```env
ENCRYPTION_SECRET="cliptica-local-test-secret-32-chars-long"

TIKTOK_CLIENT_KEY="mock_tiktok_client_key"
TIKTOK_CLIENT_SECRET="mock_tiktok_client_secret"
NEXT_PUBLIC_TIKTOK_REDIRECT_URI="http://localhost:3000/api/social/tiktok/callback"

YOUTUBE_CLIENT_ID="mock_youtube_client_id"
YOUTUBE_CLIENT_SECRET="mock_youtube_client_secret"
NEXT_PUBLIC_YOUTUBE_REDIRECT_URI="http://localhost:3000/api/social/youtube/callback"

INSTAGRAM_CLIENT_ID="mock_instagram_client_id"
INSTAGRAM_CLIENT_SECRET="mock_instagram_client_secret"
NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI="http://localhost:3000/api/social/instagram/callback"
```

### Step 2: Seed a Mock Social Connection in the Database

You can insert a test connection directly into your database using a quick Node script or Prisma Studio:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const { encryptToken } = require('./src/lib/crypto');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log('No user found in DB');
  
  await prisma.socialConnection.upsert({
    where: { userId_platform: { userId: user.id, platform: 'TIKTOK' } },
    create: {
      userId: user.id,
      platform: 'TIKTOK',
      accessToken: encryptToken('mock_access_token_tiktok'),
      refreshToken: encryptToken('mock_refresh_token_tiktok'),
      tokenExpiresAt: new Date(Date.now() + 86400000),
      platformAccountName: 'testcreator',
      platformAccountId: 'tt_mock_user_1',
    },
    update: {
      platformAccountName: 'testcreator',
      tokenExpiresAt: new Date(Date.now() + 86400000),
    }
  });
  console.log('Mock TikTok connection seeded for user:', user.email);
}
main().finally(() => prisma.\$disconnect());
"
```

### Step 3: Verify the UI

1. Open `http://localhost:3000/dashboard/settings`.
2. Scroll to **Connected Accounts & Direct Publishing**:
   - You will see TikTok display with a green dot: **Connected as @testcreator (Active)**.
   - YouTube and Instagram will display as **Not Connected** with an active **Connect** button.
3. Click **Disconnect** on TikTok:
   - The connection is instantly removed from the database and updates to **Not Connected**.
4. Open any project in `http://localhost:3000/dashboard/projects/detail?id=...`:
   - Click the **Publish** button on any completed clip card.
   - The **Publish to Social Media** modal opens with prefilled hook, title, and trending hashtags.
   - Select the target platform and review the live format specification check.
