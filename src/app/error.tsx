"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
        {error.digest ? ` (Error ID: ${error.digest})` : null}
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Try again
      </button>
    </main>
  );
}
