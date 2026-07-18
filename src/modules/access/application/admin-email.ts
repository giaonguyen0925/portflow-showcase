/** Exact match after trim + lowercase on both sides (ARD §11.2). */
export function isAllowedAdminEmail(
  candidate: string,
  adminEmail: string,
): boolean {
  return candidate.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
