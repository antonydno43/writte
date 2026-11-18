import Link from "next/link";
import { Globe } from "lucide-react";

import { Logo } from "@/components/brand";
import { FooterYear } from "@/components/landing/footer-year";

const PRODUCT_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

const COMPANY_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Create account" },
  { href: "/signup", label: "Team & roles" },
] as const;

const FOOTER_LINK_CLASSES =
  "rounded-md px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          <div>
            <Logo gradientId="yb-logo-footer" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Simple, powerful CRM for growing businesses — made with care in
              India, built for the world.
            </p>
          </div>

          <nav aria-label="Product">
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-1">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className={FOOTER_LINK_CLASSES}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h3 className="text-sm font-semibold text-foreground">Company</h3>
            <ul className="mt-4 space-y-1">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={FOOTER_LINK_CLASSES}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Made in India
            </h3>
            <div className="mt-4 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Globe className="size-5 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Designed for Indian businesses — and every business.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © <FooterYear /> YourBiz CRM. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
