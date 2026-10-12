// toast("…") anywhere in the app lands here, in beUI's animated toast stack.
import { useEffect } from "react";
import { AnimatedToastStack, useAnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { toastSignal } from "../store.tsx";

export function Toast() {
  const t = toastSignal.use();
  const stack = useAnimatedToastStack({ defaultDuration: 2400, limit: 3 });
  useEffect(() => void (t && stack.showToast({ title: t.text, status: "success" })), [t?.n]);
  return <AnimatedToastStack toasts={stack.toasts} onDismiss={stack.dismissToast} position="bottom-center" fixed classNames={{ root: "z-[200]" }} />;
}
