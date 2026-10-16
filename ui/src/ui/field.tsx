import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { ControlSizeContext, useControlSize, type ControlSize } from "@/lib/control-size"
import { cn } from "@/lib/utils"

/*
 * A form field: label, control, help text and error, wired together by the Field primitive
 * Field (the label targets the control; description and error are linked with
 * aria-describedby; `invalid` sets aria-invalid on the control).
 *
 *   <Field invalid={!!errors.email}>
 *     <FieldLabel>Email</FieldLabel>
 *     <Input type="email" />                 ← Input is a Field control
 *     <FieldDescription>We never share it.</FieldDescription>
 *     <FieldError>{errors.email}</FieldError>
 *   </Field>
 *
 * FieldError renders only while it has children, sliding open and shut.
 * Validate however you like (on submit, on blur) and pass the message in.
 *
 * `size` on Field sizes the controls inside (Input, Textarea, PasswordInput, Select and
 * Combobox triggers, MultiSelect, Checkbox, Radio, Switch, Slider) and the label; a
 * control's own `size` still wins.
 */

const fieldGap: Record<ControlSize, string> = { xs: "gap-1", sm: "gap-1.5", default: "gap-1.5", lg: "gap-2" }
const labelText: Record<ControlSize, string> = { xs: "text-ui-sm", sm: "text-ui", default: "text-ui", lg: "text-ui-lg" }

function Field({ className, size, ...props }: FieldPrimitive.Root.Props & { size?: ControlSize }) {
  const resolved = useControlSize(size)
  const root = (
    <FieldPrimitive.Root
      data-slot="field"
      data-size={resolved}
      className={cn("group/field flex min-w-0 flex-col", fieldGap[resolved], className)}
      {...props}
    />
  )
  return size ? <ControlSizeContext.Provider value={size}>{root}</ControlSizeContext.Provider> : root
}

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  const size = useControlSize()
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        labelText[size],
        // After the size: a font-size class drops an earlier leading-* when classes merge.
        "flex items-center gap-2 leading-none font-medium select-none data-disabled:opacity-64",
        className
      )}
      {...props}
    />
  )
}

/**
 * Wires any other control into the field (labels, aria-invalid, describedby):
 * `<FieldControl render={<Textarea />} />`. Input, Select, Checkbox and Switch already are field controls.
 */
function FieldControl(props: FieldPrimitive.Control.Props) {
  return <FieldPrimitive.Control data-slot="field-control" {...props} />
}

/** Label row with something at the end, e.g. a "Forgot password?" link. */
function FieldLabelRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-label-row" className={cn("flex items-center justify-between gap-3", className)} {...props} />
}

function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-ui-sm text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

type FieldErrorProps = Omit<FieldPrimitive.Error.Props, "match" | "render" | "children"> & {
  /** The message. Nothing renders while it is empty. */
  children?: React.ReactNode
}

function FieldError({ className, children, ...props }: FieldErrorProps) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <FieldPrimitive.Error
          key="error"
          match
          data-slot="field-error"
          render={
            <motion.p
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.6 }}
            />
          }
          className={cn("overflow-hidden text-ui-sm text-destructive", className)}
          {...props}
        >
          {children}
        </FieldPrimitive.Error>
      ) : null}
    </AnimatePresence>
  )
}

/** Stacks fields with the house rhythm (16px). */
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex flex-col gap-4", className)} {...props} />
}

export { Field, FieldLabel, FieldLabelRow, FieldControl, FieldDescription, FieldError, FieldGroup }
export type { FieldErrorProps }
