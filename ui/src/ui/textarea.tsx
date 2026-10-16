"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { useControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Padding and text follow the Input sizes, so a textarea under an input of the same size
// keeps the same inset and type.
const textareaVariants = cva(
  "flex field-sizing-content w-full bg-background shadow-well transition-[box-shadow,background-color] outline-none placeholder:text-muted-foreground/72 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-64 dark:bg-input/32 aria-invalid:ring-2 aria-invalid:ring-destructive/30",
  {
    variants: {
      size: {
        xs: "min-h-12 rounded-sm px-2 py-1 text-base md:text-ui-xs",
        sm: "min-h-14 rounded-lg px-2.5 py-1 text-base md:text-ui",
        default: "min-h-16 rounded-lg px-2.5 py-1.5 text-base md:text-ui",
        lg: "min-h-20 rounded-lg px-3 py-2 text-base md:text-ui-lg",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type TextareaProps = React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>

function Textarea({ className, size, ...props }: TextareaProps) {
  const resolved = useControlSize(size)
  return (
    <textarea
      data-slot="textarea"
      data-size={resolved}
      className={cn(textareaVariants({ size: resolved }), className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
export type { TextareaProps }
