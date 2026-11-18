"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

const LINK_FOCUS_CLASSES =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Sticky frosted-glass navbar with a Sheet-based mobile menu. */
export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass sticky top-0 z-50 w-full shadow-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          aria-label="YourBiz CRM home"
          className="flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Logo gradientId="yb-logo-nav" />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`flex items-center rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${LINK_FOCUS_CLASSES}`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost" className="h-11 px-5">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="h-11 px-5">
            <Link href="/signup">Start free</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              className="h-11 w-11 md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="[&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
          >
            <SheetHeader>
              <SheetTitle>
                <Logo gradientId="yb-logo-nav-sheet" />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navigation links and account actions for YourBiz CRM
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile navigation" className="px-4">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${LINK_FOCUS_CLASSES}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <SheetFooter className="mt-auto border-t border-border/60">
              <Button asChild variant="outline" className="h-12 text-base">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button asChild className="h-12 text-base">
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Start free
                </Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
