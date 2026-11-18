"use client";

/**
 * Renders the current year. Client-side render with suppressHydrationWarning
 * so a server/client year boundary never produces a hydration mismatch.
 */
export function FooterYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
