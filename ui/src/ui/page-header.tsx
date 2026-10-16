import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * The top of an app page: optional breadcrumb or eyebrow, the title, one line
 * of description, and the page's actions on the right (they wrap under the
 * title on narrow screens).
 *
 *   <PageHeader>
 *     <PageHeaderContent>
 *       <PageHeaderTitle>Customers</PageHeaderTitle>
 *       <PageHeaderDescription>Everyone with an active workspace.</PageHeaderDescription>
 *     </PageHeaderContent>
 *     <PageHeaderActions><Button>Add customer</Button></PageHeaderActions>
 *   </PageHeader>
 */

function PageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}
      {...props}
    />
  )
}

function PageHeaderContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="page-header-content" className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />
}

/** Small line above the title: a breadcrumb, a status or a section name. */
function PageHeaderEyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="page-header-eyebrow" className={cn("mb-1 flex items-center gap-2 text-ui-sm text-muted-foreground", className)} {...props} />
}

function PageHeaderTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 data-slot="page-header-title" className={cn("text-2xl font-semibold tracking-tight text-balance", className)} {...props} />
}

function PageHeaderDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="page-header-description" className={cn("max-w-2xl text-sm text-pretty text-muted-foreground", className)} {...props} />
}

function PageHeaderActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="page-header-actions" className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
}

export { PageHeader, PageHeaderContent, PageHeaderEyebrow, PageHeaderTitle, PageHeaderDescription, PageHeaderActions }
