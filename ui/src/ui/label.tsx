import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-ui leading-none font-medium select-none",
        // Inside a group marked data-disabled="true" (e.g. a disabled field row).
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        // Label after its control: native inputs use :disabled, primitive controls
        // (Checkbox, Switch, Radio render a span) set data-disabled.
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-50",
        // Label wrapping its control: mute the text only, the control dims itself.
        "has-disabled:cursor-not-allowed has-disabled:text-muted-foreground has-data-disabled:cursor-not-allowed has-data-disabled:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Label }
