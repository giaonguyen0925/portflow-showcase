import type { Metadata } from "next";

import { isAppError } from "@/lib/api/app-error";
import { requireAdmin } from "@/modules/access/application/require-admin";

import { AdminApp } from "./_components/admin-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Portflow",
  robots: { index: false, follow: false },
};

function AccessDenied() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This area is restricted to the site administrator. Sign in through the
        protected domain with the admin account.
      </p>
    </main>
  );
}

type AdminPageProps = {
  searchParams: Promise<{ project?: string | string[] }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    // Only a real "not the admin" rejection gets the friendly page.
    // Anything else (e.g. invalid env config) is a real bug and should
    // surface through the normal error boundary instead of being
    // misreported as an auth failure.
    if (isAppError(error)) {
      return <AccessDenied />;
    }
    throw error;
  }

  const params = await searchParams;
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project;

  return <AdminApp initialProjectId={projectParam ?? null} />;
}
