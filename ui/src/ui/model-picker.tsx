"use client"

import * as React from "react"

import { BoltIcon, CheckIcon, ChevronDownIcon, ShieldIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Menu, MenuContent, MenuGroup, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/ui/menu"

type PickerTone = "default" | "warning" | "destructive"

type PickerOption = {
  value: string
  label: string
  description?: string
  /** Leading glyph in the menu row and, when selected, on the trigger. */
  icon?: React.ReactNode
  /** Group heading; options with the same group sit together. */
  group?: string
  /** Colours the trigger while this option is selected (e.g. full access = warning). */
  tone?: PickerTone
  disabled?: boolean
}

type ComposerPickerProps = {
  options: PickerOption[]
  value?: string
  onValueChange?: (value: string) => void
  /** Accessible name of the trigger, e.g. "Model". */
  label: string
  /** Trigger glyph when the selected option has none. */
  icon?: React.ReactNode
  /** Heading above the options. */
  heading?: string
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string
  side?: "top" | "bottom"
  align?: "start" | "center" | "end"
  disabled?: boolean
  className?: string
  /** Extra content under the options (a "Manage models…" item). */
  footer?: React.ReactNode
  /**
   * Inside a narrow `AgentComposer` (toolbar under 28rem: phones, tablets, split panes) show only the
   * glyph and chevron; the label stays the accessible name. Ignored when there is no glyph.
   * `ModePicker` and `EffortPicker` default to `true`, `ModelPicker` and `ComposerPicker` to `false`.
   */
  compact?: boolean
}

/**
 * Small ghost trigger + menu used in agent composers: shows the selected
 * option's icon and label, opens a list with descriptions and a check on the
 * current choice. `ModelPicker`, `EffortPicker` and `ModePicker` are presets.
 */
function ComposerPicker({
  options,
  value,
  onValueChange,
  label,
  icon,
  heading,
  placeholder = "Select",
  side = "top",
  align = "start",
  disabled,
  className,
  footer,
  compact = false,
}: ComposerPickerProps) {
  const selected = options.find((o) => o.value === value)
  const glyph = selected?.icon ?? icon
  const groups = React.useMemo(() => {
    const map = new Map<string, PickerOption[]>()
    for (const o of options) {
      const key = o.group ?? ""
      map.set(key, [...(map.get(key) ?? []), o])
    }
    return [...map.entries()]
  }, [options])

  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${label}: ${selected?.label ?? placeholder}`}
            data-slot="composer-picker"
            data-tone={selected?.tone ?? "default"}
            data-compact={(compact && !!glyph) || undefined}
            className={cn(
              // Shrinks (label truncates) instead of pushing the composer toolbar wider.
              "min-w-0 shrink px-2 font-normal text-muted-foreground hover:text-foreground data-[tone=destructive]:text-destructive data-[tone=warning]:text-warning",
              className
            )}
          />
        }
      >
        {glyph && <span className="flex shrink-0 items-center [&_svg]:size-3.5">{glyph}</span>}
        <span className={cn("min-w-0 truncate", compact && glyph && "@max-md/composer-toolbar:hidden")}>{selected?.label ?? placeholder}</span>
        <ChevronDownIcon data-icon="inline-end" className="size-3 opacity-64" />
      </MenuTrigger>
      <MenuContent side={side} align={align} className="max-h-80 w-64">
        {/* design-check-ignore menu-label-group -- a title above the groups renders as a plain heading */}
        {heading && <MenuLabel>{heading}</MenuLabel>}
        {groups.map(([group, items], gi) => (
          <React.Fragment key={group || gi}>
            {gi > 0 && <MenuSeparator />}
            <MenuGroup>
              {group && <MenuLabel>{group}</MenuLabel>}
              {items.map((o) => (
                <MenuItem
                  key={o.value}
                  disabled={o.disabled}
                  onClick={() => onValueChange?.(o.value)}
                  className={cn("items-start py-1", o.tone === "warning" && "[&_svg]:text-warning", o.tone === "destructive" && "[&_svg]:text-destructive")}
                >
                  {o.icon && <span className="flex h-4.5 shrink-0 items-center">{o.icon}</span>}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.description && <span className="text-ui-xs text-pretty text-muted-foreground">{o.description}</span>}
                  </span>
                  <span className="flex h-4.5 w-4 shrink-0 items-center justify-center">
                    {o.value === value && <CheckIcon className="!text-foreground" />}
                  </span>
                </MenuItem>
              ))}
            </MenuGroup>
          </React.Fragment>
        ))}
        {footer && (
          <>
            <MenuSeparator />
            {footer}
          </>
        )}
      </MenuContent>
    </Menu>
  )
}

type ModelOption = { id: string; name: string; description?: string; provider?: string; icon?: React.ReactNode; disabled?: boolean }

type ModelPickerProps = Omit<ComposerPickerProps, "options" | "label"> & {
  models: ModelOption[]
  label?: string
}

/** Model menu, grouped by `provider` when given. */
function ModelPicker({ models, label = "Model", heading, ...props }: ModelPickerProps) {
  const options = models.map<PickerOption>((m) => ({
    value: m.id,
    label: m.name,
    description: m.description,
    group: m.provider,
    icon: m.icon,
    disabled: m.disabled,
  }))
  return <ComposerPicker options={options} label={label} heading={heading} {...props} />
}

type EffortLevel = { value: string; label: string; description?: string }

const DEFAULT_EFFORT: EffortLevel[] = [
  { value: "low", label: "Low", description: "Fastest, for small edits" },
  { value: "medium", label: "Medium", description: "Balanced" },
  { value: "high", label: "High", description: "Thinks longer on hard problems" },
]

type EffortPickerProps = Omit<ComposerPickerProps, "options" | "label"> & {
  levels?: EffortLevel[]
  label?: string
}

/** Reasoning effort (thought level), with a bolt glyph. */
function EffortPicker({ levels = DEFAULT_EFFORT, label = "Reasoning effort", icon, heading = "Reasoning effort", compact = true, ...props }: EffortPickerProps) {
  return (
    <ComposerPicker
      compact={compact}
      options={levels.map((l) => ({ ...l }))}
      label={label}
      heading={heading}
      icon={icon ?? <BoltIcon />}
      {...props}
    />
  )
}

type ModeOption = { id: string; name: string; description?: string; icon?: React.ReactNode; tone?: PickerTone }

type ModePickerProps = Omit<ComposerPickerProps, "options" | "label"> & {
  modes: ModeOption[]
  label?: string
}

/** Agent mode / access level ("Ask", "Auto", "Full access"); a mode can colour the trigger with `tone`. */
function ModePicker({ modes, label = "Mode", icon, compact = true, ...props }: ModePickerProps) {
  const options = modes.map<PickerOption>((m) => ({
    value: m.id,
    label: m.name,
    description: m.description,
    icon: m.icon,
    tone: m.tone,
  }))
  return <ComposerPicker options={options} label={label} icon={icon ?? <ShieldIcon />} compact={compact} {...props} />
}

export {
  ComposerPicker,
  ModelPicker,
  EffortPicker,
  ModePicker,
  type ComposerPickerProps,
  type PickerOption,
  type PickerTone,
  type ModelOption,
  type ModelPickerProps,
  type EffortLevel,
  type EffortPickerProps,
  type ModeOption,
  type ModePickerProps,
}
