"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  Settings,
  Users,
  UsersRound,
  X,
} from "lucide-react"

import { Logo } from "@/components/brand"
import { useApp } from "@/components/app/app-provider"
import { UserMenu } from "@/components/app/user-menu"
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/deals", label: "Deals", icon: KanbanSquare },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/team", label: "Team", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
]

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, mode } = useApp()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" aria-hidden="true" />
        <span className="sr-only" role="status">
          Loading your workspace
        </span>
      </div>
    )
  }

  const mobileMoreSheet = (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
        <SheetTitle className="sr-only">More navigation</SheetTitle>
        <div className="flex items-center justify-between pb-3">
          <Logo gradientId="sheet-logo" />
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <WorkspaceSwitcher />
        <div className="mt-3">
          <NavLinks onNavigate={() => setMobileNavOpen(false)} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <UserMenu compact />
        </div>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center px-5 pb-4 pt-5">
          <Link href="/dashboard" aria-label="YourBiz CRM dashboard">
            <Logo gradientId="sidebar-logo" />
          </Link>
        </div>
        <div className="px-4">
          <WorkspaceSwitcher />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
          <NavLinks />
        </div>
        <div className="border-t px-4 py-3">
          <UserMenu />
          {mode === "local" && (
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
              Preview mode — data is stored locally and resets when the dev server restarts.
            </p>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link href="/dashboard" aria-label="YourBiz CRM dashboard">
          <Logo gradientId="mobile-logo" />
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="max-w-44 truncate"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Switch workspace and open menu"
        >
          {pathname === "/" ? "Menu" : null}
          More
        </Button>
      </header>

      {mobileMoreSheet}

      {/* Main content */}
      <main className="min-h-[calc(100vh-3.5rem)] pb-24 lg:ml-64 lg:pb-0">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/90 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.slice(0, 4).map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
          aria-label="Open more navigation"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  )
}
