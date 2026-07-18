import type { Metadata } from "next";
import Link from "next/link";

import { siteFontClassName } from "@/app/fonts";
import { loadPublishedContent } from "@/modules/publishing/infrastructure/published-content-source";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const published = await loadPublishedContent();
  if (!published) {
    return { title: "Portfolio" };
  }

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

  return (
    <main
      className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 bg-white px-6 py-16 text-zinc-900 ${siteFontClassName(site.font)}`}
    >
      <header className="flex flex-col items-start gap-4">
        {site.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2-hosted asset, served as-is
          <img
            src={site.avatarUrl}
            alt=""
            className="size-16 rounded-full object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{site.title}</h1>
        {site.bio ? (
          <p className="max-w-2xl whitespace-pre-line text-base leading-7 text-zinc-600">
            {site.bio}
          </p>
        ) : null}
        {site.socialLinks.length > 0 ? (
          <ul className="flex flex-wrap gap-4">
            {site.socialLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {manifest.projects.length > 0 ? (
        <section aria-label="Projects" className="grid gap-8 sm:grid-cols-2">
          {manifest.projects.map((project) => (
            <Link
              key={project.id}
              href={`/${project.slug}`}
              className="group flex flex-col gap-3"
            >
              {project.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- R2-hosted asset, no crop (ARD §10)
                <img
                  src={project.coverUrl}
                  alt=""
                  width={project.coverWidth}
                  height={project.coverHeight}
                  loading="lazy"
                  className="h-auto w-full rounded-lg bg-zinc-100"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400">
                  {project.title}
                </div>
              )}
              <div>
                <h2 className="text-base font-medium group-hover:underline group-hover:underline-offset-4">
                  {project.title}
                </h2>
                {project.summary ? (
                  <p className="mt-1 text-sm text-zinc-600">{project.summary}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">No published projects yet.</p>
      )}
    </main>
  );
}
