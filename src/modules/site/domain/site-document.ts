import { z } from "zod";

export const SITE_FONTS = ["inter", "manrope", "space-grotesk"] as const;

export type SiteFont = (typeof SITE_FONTS)[number];

export const MAX_SITE_TITLE_LENGTH = 80;
export const MAX_BIO_LENGTH = 1_000;
export const MAX_SOCIAL_LINKS = 10;

export const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.url(),
});

export const siteDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(MAX_SITE_TITLE_LENGTH),
  bio: z.string().max(MAX_BIO_LENGTH),
  avatarAssetId: z
    .string()
    .regex(/^asset_[a-f0-9]{32}$/)
    .optional(),
  font: z.enum(SITE_FONTS),
  socialLinks: z.array(socialLinkSchema).max(MAX_SOCIAL_LINKS),
  revision: z.number().int().min(0),
  updatedAt: z.iso.datetime(),
});

export type SiteDocument = z.infer<typeof siteDocumentSchema>;

/** Fields the admin can edit; everything else is system-managed. */
export const siteInputSchema = siteDocumentSchema.pick({
  title: true,
  bio: true,
  avatarAssetId: true,
  font: true,
  socialLinks: true,
});

export type SiteInput = z.infer<typeof siteInputSchema>;

export function createInitialSiteDocument(
  now: Date = new Date(),
): SiteDocument {
  return {
    schemaVersion: 1,
    title: "My Portfolio",
    bio: "",
    font: "inter",
    socialLinks: [],
    revision: 0,
    updatedAt: now.toISOString(),
  };
}
