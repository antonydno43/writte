"use client"

import { Check, ChevronsUpDown, Plus, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { useApp } from "@/components/app/app-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { workspaces, activeWorkspace, switchWorkspace, user } = useApp()
  const router = useRouter()

  if (!user) return null

  const roleLabel: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-auto w-full justify-between gap-2 px-3 py-2.5 text-left font-normal"
            aria-label={`Workspaces — current: ${activeWorkspace?.name ?? "none"}`}
          >
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="w-full truncate text-sm font-semibold leading-tight text-foreground">
                {activeWorkspace?.name ?? "No workspace"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {activeWorkspace ? `${roleLabel[activeWorkspace.role] ?? activeWorkspace.role} · ${activeWorkspace.baseCurrency}` : "Create one to start"}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Your workspaces</DropdownMenuLabel>
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onSelect={async (e) => {
                e.preventDefault()
                if (activeWorkspace?.id !== ws.id) await switchWorkspace(ws.id)
                router.push("/dashboard")
              }}
              className="gap-2"
            >
              <Check
                className={cn("size-4 shrink-0", activeWorkspace?.id === ws.id ? "opacity-100" : "opacity-0")}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{ws.name}</span>
                <span className="text-[11px] text-muted-foreground">{roleLabel[ws.role] ?? ws.role}</span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              router.push("/onboarding?new=1")
            }}
            className="gap-2"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span>Create a new workspace</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              router.push("/team")
            }}
            className="gap-2"
          >
            <UsersRound className="size-4 shrink-0" aria-hidden="true" />
            <span>Invite people & team</span>
            <DropdownMenuShortcut>Team</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
