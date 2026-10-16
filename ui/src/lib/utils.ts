import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The theme adds a native 13px type scale (text-ui-2xs … text-ui-lg). Teach tailwind-merge
// that these are font sizes, so `cn("text-ui", "text-muted-foreground")` keeps both.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["ui", "ui-lg", "ui-sm", "ui-xs", "ui-2xs"] }],
      // Concentric radius utilities (frame-* on the container, rounded-inner on children).
      rounded: [{ rounded: ["inner"] }],
      "rounded-t": [{ "rounded-t": ["inner"] }],
      "rounded-b": [{ "rounded-b": ["inner"] }],
      "rounded-s": [{ "rounded-s": ["inner"] }],
      "rounded-e": [{ "rounded-e": ["inner"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
