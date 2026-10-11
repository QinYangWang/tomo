import { toastSignal } from "../store.tsx";
export function Toast() {
  const t = toastSignal.use();
  return t ? <div id="toast" role="status">{t.text}</div> : null;
}
