"use client"

import { LogOut, Settings, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { useApp } from "@/components/app/app-provider"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useApp()
  const router = useRouter()

  if (!user) return null

  return (
    <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"}>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-1.5" aria-label="Account menu">
            <OwnerAvatar name={user.name} size="sm" />
            <span className="hidden max-w-28 truncate text-sm font-medium md:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Timezone: {user.timezone.replace(/_/g, " ")} · {user.currency}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/settings")} className="gap-2">
            <UserRound className="size-4" aria-hidden="true" /> Profile & preferences
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings?tab=workspace")} className="gap-2">
            <Settings className="size-4" aria-hidden="true" /> Workspace settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logout()} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
