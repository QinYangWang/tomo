"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * A round (or squircle) picture of a person: an image with an initials fallback,
 * five sizes, an optional status dot, and an overlapping group.
 *
 * The root is opaque (`bg-card`) so stacked avatars never show through each
 * other; the image and fallback clip to the root's radius, and a 1px inset
 * hairline (foreground at 8%) keeps light photos from melting into the page.
 * The status dot sits outside the clip, cut out of the page with a ring in
 * `background`.
 */

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"
type AvatarShape = "circle" | "rounded"
/** `default` is an alias of `md` (32px), matching the other components' size names. */
type AvatarSizeProp = AvatarSize | "default"

function toAvatarSize(size: AvatarSizeProp): AvatarSize {
  return size === "default" ? "md" : size
}

const AvatarGroupContext = React.createContext<{ size?: AvatarSize; shape?: AvatarShape } | null>(null)

const avatarVariants = cva(
  "group/avatar relative inline-flex shrink-0 items-center justify-center bg-card align-middle select-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-foreground/8 after:ring-inset",
  {
    variants: {
      size: {
        xs: "size-5 text-ui-2xs",
        sm: "size-6 text-ui-2xs",
        md: "size-8 text-ui-sm",
        lg: "size-10 text-ui",
        xl: "size-12 text-ui-lg",
      },
      shape: {
        circle: "rounded-full",
        rounded: "",
      },
    },
    compoundVariants: [
      // Squircle radii scale with the box (~25%) so every size reads as the same shape.
      { shape: "rounded", size: "xs", className: "rounded-sm" },
      { shape: "rounded", size: "sm", className: "rounded-sm" },
      { shape: "rounded", size: "md", className: "rounded-md" },
      { shape: "rounded", size: "lg", className: "rounded-lg" },
      { shape: "rounded", size: "xl", className: "rounded-xl" },
    ],
    defaultVariants: { size: "md", shape: "circle" },
  }
)

type AvatarProps = AvatarPrimitive.Root.Props & Omit<VariantProps<typeof avatarVariants>, "size"> & { size?: AvatarSizeProp | null }

function Avatar({ className, size, shape, ...props }: AvatarProps) {
  const group = React.useContext(AvatarGroupContext)
  const resolvedSize = toAvatarSize(size ?? group?.size ?? "md")
  const resolvedShape = shape ?? group?.shape ?? "circle"
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={resolvedSize}
      data-shape={resolvedShape}
      className={cn(avatarVariants({ size: resolvedSize, shape: resolvedShape }), className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("size-full rounded-[inherit] object-cover", className)}
      {...props}
    />
  )
}

/** Shown while the image loads or when it fails: initials or an icon. Pass `delay` (ms) to avoid a flash on fast loads. */
function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] bg-secondary font-medium text-muted-foreground uppercase [&_svg:not([data-slot=generated-avatar])]:size-[55%]",
        className
      )}
      {...props}
    />
  )
}

const avatarStatusVariants = cva(
  "pointer-events-none absolute z-10 rounded-full ring-2 ring-background group-data-[shape=rounded]/avatar:-end-0.5 group-data-[shape=rounded]/avatar:-bottom-0.5 group-data-[shape=circle]/avatar:end-0 group-data-[shape=circle]/avatar:bottom-0 group-data-[size=lg]/avatar:size-2.5 group-data-[size=md]/avatar:size-2.5 group-data-[size=sm]/avatar:size-2 group-data-[size=xl]/avatar:size-3 group-data-[size=xs]/avatar:size-1.5 group-data-[size=xs]/avatar:ring-[1.5px]",
  {
    variants: {
      status: {
        online: "bg-success",
        away: "bg-warning",
        busy: "bg-destructive",
        offline: "bg-muted-foreground",
      },
    },
    defaultVariants: { status: "online" },
  }
)

/** Presence dot at the bottom-right of an `Avatar`; sized from the avatar's `size`. */
function AvatarStatus({
  className,
  status = "online",
  label,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof avatarStatusVariants> & { label?: string }) {
  return (
    <span
      data-slot="avatar-status"
      data-status={status}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(avatarStatusVariants({ status }), className)}
      {...props}
    />
  )
}

const avatarGroupVariants = cva(
  "flex items-center *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
  {
    variants: {
      size: {
        xs: "-space-x-1 *:data-[slot=avatar]:ring-[1.5px]",
        sm: "-space-x-1.5",
        md: "-space-x-2",
        lg: "-space-x-2.5",
        xl: "-space-x-3",
      },
    },
    defaultVariants: { size: "md" },
  }
)

/** Overlapping stack. Its `size` and `shape` become the default for every `Avatar` inside. */
function AvatarGroup({
  className,
  size: sizeProp = "md",
  shape = "circle",
  ...props
}: React.ComponentProps<"div"> & { size?: AvatarSizeProp; shape?: AvatarShape }) {
  const size = toAvatarSize(sizeProp)
  const value = React.useMemo(() => ({ size, shape }), [size, shape])
  return (
    <AvatarGroupContext.Provider value={value}>
      <div
        data-slot="avatar-group"
        data-size={size}
        className={cn(avatarGroupVariants({ size }), className)}
        {...props}
      />
    </AvatarGroupContext.Provider>
  )
}

/** The "+N" tile at the end of a group, drawn as an avatar of the group's size. */
function AvatarGroupCount({ className, children, ...props }: AvatarProps) {
  return (
    <Avatar className={cn("tabular-nums", className)} {...props}>
      <span
        data-slot="avatar-group-count"
        className="flex size-full items-center justify-center rounded-[inherit] bg-secondary font-medium text-muted-foreground"
      >
        {children}
      </span>
    </Avatar>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarStatus,
  AvatarGroup,
  AvatarGroupCount,
  avatarVariants,
  type AvatarSize,
  type AvatarSizeProp,
  type AvatarShape,
}
