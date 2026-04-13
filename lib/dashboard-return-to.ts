/**
 * Validates `returnTo` query values for in-app navigation (e.g. customer detail → back).
 * Only allows same-origin dashboard paths.
 */
export function sanitizeDashboardReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.length > 256) return null;
  if (!decoded.startsWith('/dashboard')) return null;
  if (decoded.includes('//') || decoded.includes('\\')) return null;
  return decoded;
}
