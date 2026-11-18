"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Dismissible early-access banner rendered above the sticky navbar. */
export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Early access announcement"
      className="bg-primary text-primary-foreground"
    >
      <div className="relative mx-auto flex min-h-12 w-full max-w-7xl items-center justify-center px-4 pr-16 sm:px-6 sm:pr-16 lg:px-8">
        <p className="text-center text-xs font-medium sm:text-sm">
          Early access — the Growth plan is free while we build. No credit card
          needed.
        </p>
        <Button
          type="button"
          variant="ghost"
          aria-label="Dismiss announcement"
          onClick={() => setVisible(false)}
          className="absolute right-2 h-11 w-11 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-primary-foreground/40"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
