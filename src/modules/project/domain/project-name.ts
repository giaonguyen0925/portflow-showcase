export const MAX_PROJECT_NAME_LENGTH = 120;

/**
 * Canonical form used for duplicate detection: Unicode NFKC, trimmed,
 * collapsed whitespace, Vietnamese-aware lowercase.
 */
export function normalizeProjectName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}
