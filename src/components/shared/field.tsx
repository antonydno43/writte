"use client"

import { forwardRef } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FieldProps extends React.ComponentProps<typeof Input> {
  label: string
  hint?: string
  error?: string | null
}

/** A labelled form field with optional hint + inline error. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, id, ...props },
  ref
) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(error && "border-destructive/60 focus-visible:ring-destructive/30", className)}
        {...props}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})
