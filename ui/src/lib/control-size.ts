"use client";

import * as React from "react"

/**
 * Shared height scale for form controls, the same steps as Button:
 * `xs` 24px, `sm` 28px, `default` 32px, `lg` 36px. A `Field` (or a compound root such as
 * `Select`) publishes its size here and the controls inside read it, so one prop sizes a
 * whole row. A control's own `size` prop always wins.
 */
type ControlSize = "xs" | "sm" | "default" | "lg"

const ControlSizeContext = React.createContext<ControlSize | undefined>(undefined)

/** The size from the nearest provider, or `fallback`. Pass a control's own prop first. */
function useControlSize<S extends string = ControlSize>(own?: S | null, fallback: S = "default" as S): S {
  const inherited = React.useContext(ControlSizeContext)
  return (own ?? (inherited as S | undefined) ?? fallback) as S
}

export { ControlSizeContext, useControlSize }
export type { ControlSize }
