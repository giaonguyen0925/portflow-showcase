import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { siteFontClassName } from "@/app/fonts";
import { firstImageBlock } from "@/modules/layout/domain/blocks";
import { pageThemeStyle } from "@/modules/layout/domain/page-theme";
import { RowsView } from "@/modules/layout/presentation/rows-view";
import { isValidSlug } from "@/modules/project/domain/slug";
import {
  loadPublishedContent,
  loadPublishedProject,
} from "@/modules/publishing/infrastructure/published-content-source";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ projectSlug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { projectSlug } = await props.params;
  if (!isValidSlug(projectSlug)) {
    return {};
  }

  const [project, published] = await Promise.all([
    loadPublishedProject(projectSlug),
    loadPublishedContent(),
  ]);
  if (!project) {
    return {};
  }

  const title = published
    ? `${project.title} — ${published.site.title}`
    : project.title;
  const description = project.summary || undefined;
  const cover = firstImageBlock(project.rows);

  return {
    title,
    ...(description === undefined ? {} : { description }),
    alternates: { canonical: `/${project.slug}` },
    openGraph: {
      title,
      ...(description === undefined ? {} : { description }),
      url: `/${project.slug}`,
      type: "article",
      ...(cover === undefined
        ? {}
        : {
            images: [
              {
                url: cover.asset.url,
                width: cover.asset.width,
                height: cover.asset.height,
              },
            ],
          }),
    },
  };
}

export default async function ProjectPage(props: PageProps) {
  const { projectSlug } = await props.params;
  if (!isValidSlug(projectSlug)) {
    notFound();
  }

  const [project, published] = await Promise.all([
    loadPublishedProject(projectSlug),
    loadPublishedContent(),
  ]);
  if (!project) {
    notFound();
  }

  const fontClass = published ? siteFontClassName(published.site.font) : "";

  return (
    <main
      className={`flex flex-1 flex-col ${fontClass}`}
      style={pageThemeStyle(project.theme)}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 lg:gap-10 px-2 lg:px-6 py-6 lg:py-16">
        <nav>
          <Link
            href="/"
            className="text-sm underline-offset-4 opacity-60 hover:underline hover:opacity-100"
          >
            ← {published?.site.title ?? "Home"}
          </Link>
        </nav>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {project.title}
          </h1>
          {project.summary ? (
            <p className="max-w-2xl text-base leading-7 opacity-80">
              {project.summary}
            </p>
          ) : null}
        </header>

        {project.rows.length > 0 ? (
          <section aria-label="Project content">
            <RowsView rows={project.rows} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
