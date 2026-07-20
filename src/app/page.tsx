import type { Metadata } from "next";

import { siteFontClassName } from "@/app/fonts";
import { pageThemeStyle } from "@/modules/layout/domain/page-theme";
import { RowsView } from "@/modules/layout/presentation/rows-view";
import { loadPublishedContent } from "@/modules/publishing/infrastructure/published-content-source";
import { ProfileBlockView } from "@/modules/site/presentation/profile-block-view";
import { ProjectGridBlockView } from "@/modules/site/presentation/project-grid-block-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const published = await loadPublishedContent();
  if (!published) {
    return { title: "Portfolio" };
  }

  // Metadata comes from the structured site fields, never from the visual
  // layout — hiding or moving the profile block doesn't affect SEO.
  const description = published.site.bio.slice(0, 160) || undefined;
  return {
    title: published.site.title,
    ...(description === undefined ? {} : { description }),
    alternates: { canonical: "/" },
    openGraph: {
      title: published.site.title,
      ...(description === undefined ? {} : { description }),
      url: "/",
      type: "website",
    },
  };
}

export default async function HomePage() {
  const published = await loadPublishedContent();

  if (!published) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nothing here yet
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          This portfolio has not been published.
        </p>
      </main>
    );
  }

  const { site, manifest } = published;
  const profile = {
    title: site.title,
    bio: site.bio,
    avatarUrl: site.avatarUrl ?? null,
    socialLinks: site.socialLinks,
  };

  return (
    <main
      className={`flex flex-1 flex-col ${siteFontClassName(site.font)}`}
      style={pageThemeStyle(site.theme)}
    >
      <div className="mx-auto w-full max-w-5xl flex-1 px-2 lg:px-6 py-6 lg:py-16">
        <RowsView
          rows={site.rows}
          renderBlock={(block) => {
            if (block.type === "profile") {
              return <ProfileBlockView block={block} profile={profile} />;
            }
            if (block.type === "project-grid") {
              return (
                <ProjectGridBlockView block={block} projects={manifest.projects} />
              );
            }
            return undefined;
          }}
        />
      </div>
    </main>
  );
}
