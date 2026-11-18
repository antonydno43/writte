import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  /**
   * Unique id for the SVG gradient definition. Pass a distinct value whenever
   * more than one logo is rendered on the same page so DOM ids stay unique.
   */
  gradientId?: string;
}

/**
 * Square teal gradient mark with a stylized white "Y" drawn as a flowing
 * route/checkmark stroke. 32px by default, safe on light and dark surfaces.
 */
export function LogoMark({ className, gradientId = "yb-logo-mark" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="YourBiz CRM logo mark"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0d9488" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <g
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M9.5 10.5 15.5 16.5" />
        <path d="M22.5 10.5 16.5 16.5" />
        <path d="M16 16.5c0 2.2 1.3 3.5 1.3 6" />
      </g>
    </svg>
  );
}

interface LogoProps {
  className?: string;
  gradientId?: string;
}

/** Full wordmark lockup: LogoMark + "YourBiz" + a small teal "CRM" pill. */
export function Logo({ className, gradientId }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark gradientId={gradientId} />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        YourBiz
      </span>
      <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
        CRM
      </span>
    </span>
  );
}
