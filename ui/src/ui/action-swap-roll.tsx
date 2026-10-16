"use client"

import {
  ActionSwapButton,
  ActionSwapIcon,
  ActionSwapText,
  type ActionSwapButtonProps,
  type ActionSwapIconProps,
  type ActionSwapItem,
  type ActionSwapTextProps,
} from "@/ui/action-swap-blur"

/* Roll preset: the next label and icon roll up from below through a soft blur while the old ones lift out. */

type ActionSwapRollButtonProps = Omit<ActionSwapButtonProps, "animation">
type ActionSwapRollTextProps = Omit<ActionSwapTextProps, "animation">
type ActionSwapRollIconProps = Omit<ActionSwapIconProps, "animation">

function ActionSwapRollButton(props: ActionSwapRollButtonProps) {
  return <ActionSwapButton {...props} animation="roll" />
}

function ActionSwapRollText(props: ActionSwapRollTextProps) {
  return <ActionSwapText {...props} animation="roll" />
}

function ActionSwapRollIcon(props: ActionSwapRollIconProps) {
  return <ActionSwapIcon {...props} animation="roll" />
}

export {
  ActionSwapRollButton,
  ActionSwapRollText,
  ActionSwapRollIcon,
  type ActionSwapItem,
  type ActionSwapRollButtonProps,
  type ActionSwapRollTextProps,
  type ActionSwapRollIconProps,
}
