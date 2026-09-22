export const DEFAULT_ADMIN_EMAILS = ['abbdelraheem@gmail.com']

/**
 * Checks if an email belongs to a system administrator.
 * Case-insensitive, trims whitespace.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  const envEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const allAdmins = new Set([...DEFAULT_ADMIN_EMAILS, ...envEmails])
  return allAdmins.has(normalized)
}
