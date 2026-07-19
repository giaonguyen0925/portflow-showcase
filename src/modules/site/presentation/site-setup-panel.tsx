"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import {
  SITE_FONTS,
  type SiteFont,
} from "@/modules/site/domain/site-document";

export type SiteProfileFields = {
  title: string;
  bio: string;
  avatarAssetId: string | undefined;
  font: SiteFont;
  socialLinks: Array<{ label: string; url: string }>;
};

/**
 * Homepage identity fields (title, bio, avatar, font, socials). Used inside
 * the homepage editor so setup lives next to the layout canvas.
 */
export function SiteSetupPanel({
  value,
  avatarPreview,
  onChange,
  onAvatarChange,
}: {
  value: SiteProfileFields;
  avatarPreview: string | null;
  onChange: (next: SiteProfileFields) => void;
  onAvatarChange: (assetId: string, previewUrl: string) => void;
}) {
  function patch(partial: Partial<SiteProfileFields>) {
    onChange({ ...value, ...partial });
  }

  return (
    <section className="w-5xl mx-auto flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
      <header>
        <h2 className="text-base font-semibold">Homepage setup</h2>
        <p className="text-sm text-muted-foreground">
          Profile info shown on your public homepage. Changes autosave with the
          layout below.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="site-title">Portfolio title</Label>
          <Input
            id="site-title"
            value={value.title}
            maxLength={80}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="site-bio">Bio</Label>
          <Textarea
            id="site-bio"
            value={value.bio}
            maxLength={1000}
            rows={3}
            onChange={(event) => patch({ bio: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Avatar</Label>
          <div className="flex items-center gap-3">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- R2 asset preview
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="size-14 rounded-full bg-muted object-cover"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                None
              </div>
            )}
            <UploadDropzone
              scope="site-avatar"
              multiple={false}
              accept="image/*"
              label="Upload avatar"
              onAsset={(asset) => {
                if (asset.contentType !== "image/webp") {
                  return;
                }
                onAvatarChange(asset.id, asset.url);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-font">Font</Label>
          <select
            id="site-font"
            value={value.font}
            onChange={(event) =>
              patch({ font: event.target.value as SiteFont })
            }
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SITE_FONTS.map((font) => (
              <option key={font} value={font}>
                {font === "space-grotesk"
                  ? "Space Grotesk"
                  : font.charAt(0).toUpperCase() + font.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Social links</Label>
        {value.socialLinks.map((link, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={link.label}
              placeholder="Label"
              maxLength={40}
              className="w-32"
              onChange={(event) =>
                patch({
                  socialLinks: value.socialLinks.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item,
                  ),
                })
              }
            />
            <Input
              value={link.url}
              placeholder="https://…"
              onChange={(event) =>
                patch({
                  socialLinks: value.socialLinks.map((item, i) =>
                    i === index ? { ...item, url: event.target.value } : item,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${link.label || "link"}`}
              onClick={() =>
                patch({
                  socialLinks: value.socialLinks.filter((_, i) => i !== index),
                })
              }
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={value.socialLinks.length >= 10}
          onClick={() =>
            patch({
              socialLinks: [...value.socialLinks, { label: "", url: "" }],
            })
          }
        >
          Add link
        </Button>
      </div>
    </section>
  );
}
