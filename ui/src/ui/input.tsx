"use client";

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { useControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// Heights match Button (xs 24, sm 28, default 32, lg 36) so a field and its button line up.
// Phones get 16px text below md so focusing never zooms the page.
const inputVariants = cva(
  "w-full min-w-0 bg-background shadow-well transition-[box-shadow,background-color] outline-none placeholder:text-muted-foreground/72 file:inline-flex file:border-0 file:bg-transparent file:font-medium focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-64 dark:bg-input/32 aria-invalid:ring-2 aria-invalid:ring-destructive/30",
  {
    variants: {
      size: {
        xs: "h-6 rounded-sm px-2 py-0.5 text-base file:h-5 file:text-ui-xs md:text-ui-xs",
        sm: "h-7 rounded-lg px-2.5 py-0.5 text-base file:h-5 file:text-ui-sm md:text-ui",
        default: "h-8 rounded-lg px-2.5 py-1 text-base file:h-6 file:text-ui-sm md:text-ui",
        lg: "h-9 rounded-lg px-3 py-1 text-base file:h-7 file:text-ui md:text-ui-lg",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants> & {
    /** The native `size` attribute (visible width in characters). */
    htmlSize?: number
  }

function Input({ className, type, size, htmlSize, ...props }: InputProps) {
  const resolved = useControlSize(size)
  return (
    <InputPrimitive
      type={type}
      size={htmlSize}
      data-slot="input"
      data-size={resolved}
      className={cn(inputVariants({ size: resolved }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
export type { InputProps }
