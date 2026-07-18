"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiFetch, withResourceLock } from "@/lib/api/client";
import type { SaveSiteResponse } from "@/lib/api/contracts";
import {
  SITE_FONTS,
  type SiteDocument,
  type SiteFont,
} from "@/modules/site/domain/site-document";
import { UploadDropzone } from "@/modules/asset/presentation/upload-dropzone";
import { useAdminUiStore } from "@/stores/admin-ui-store";

type SocialLinkDraft = { label: string; url: string };

type SiteFormState = {
  title: string;
  bio: string;
  avatarAssetId: string | undefined;
  font: SiteFont;
  socialLinks: SocialLinkDraft[];
};

function toFormState(site: SiteDocument): SiteFormState {
  return {
    title: site.title,
    bio: site.bio,
    avatarAssetId: site.avatarAssetId,
    font: site.font,
    socialLinks: site.socialLinks.map((link) => ({ ...link })),
  };
}

export function SiteSettingsForm({
  site,
  avatarUrl,
  onSaved,
}: {
  site: SiteDocument;
  avatarUrl: string | null;
  onSaved: (site: SiteDocument) => void;
}) {
  const [form, setForm] = useState<SiteFormState>(() => toFormState(site));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const setDirty = useAdminUiStore((state) => state.setDirty);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toFormState(site)),
    [form, site],
  );

  useEffect(() => {
    setDirty("site", isDirty);
    return () => setDirty("site", false);
  }, [isDirty, setDirty]);

  function patch(partial: Partial<SiteFormState>) {
    setForm((current) => ({ ...current, ...partial }));
    setMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await withResourceLock("site", () =>
        apiFetch<SaveSiteResponse>("/api/admin/site", {
          method: "PUT",
          body: JSON.stringify({
            title: form.title,
            bio: form.bio,
            ...(form.avatarAssetId === undefined
              ? {}
              : { avatarAssetId: form.avatarAssetId }),
            font: form.font,
            socialLinks: form.socialLinks,
            expectedRevision: site.revision,
          }),
        }),
      );
      onSaved(response.site);
      setMessage("Saved.");
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "REVISION_CONFLICT") {
        setMessage(
          "These settings were changed in another tab. Reload the page to continue.",
        );
      } else {
        setMessage(error instanceof Error ? error.message : "Save failed");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Site settings</h2>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              Unsaved changes
            </span>
          ) : null}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-title">Portfolio title</Label>
        <Input
          id="site-title"
          value={form.title}
          maxLength={80}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-bio">Bio</Label>
        <Textarea
          id="site-bio"
          value={form.bio}
          maxLength={1000}
          rows={4}
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
            label="Upload avatar"
            onAsset={(asset) => {
              patch({ avatarAssetId: asset.id });
              setAvatarPreview(asset.url);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-font">Font</Label>
        <select
          id="site-font"
          value={form.font}
          onChange={(event) => patch({ font: event.target.value as SiteFont })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {SITE_FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Social links</Label>
        {form.socialLinks.map((link, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={link.label}
              placeholder="Label"
              maxLength={40}
              className="w-32"
              onChange={(event) =>
                patch({
                  socialLinks: form.socialLinks.map((l, i) =>
                    i === index ? { ...l, label: event.target.value } : l,
                  ),
                })
              }
            />
            <Input
              value={link.url}
              placeholder="https://…"
              onChange={(event) =>
                patch({
                  socialLinks: form.socialLinks.map((l, i) =>
                    i === index ? { ...l, url: event.target.value } : l,
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
                  socialLinks: form.socialLinks.filter((_, i) => i !== index),
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
          disabled={form.socialLinks.length >= 10}
          onClick={() =>
            patch({ socialLinks: [...form.socialLinks, { label: "", url: "" }] })
          }
        >
          Add link
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
