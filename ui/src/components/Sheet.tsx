// Modal sheet and the confirm dialog, on beUI: a center-unfolding modal on desktop, a draggable bottom sheet on phones.
import { useEffect, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { cn } from "@/lib/utils";
import { confirmSignal, isPhone } from "../store.tsx";
import { Btn } from "./kit.tsx";

function usePhone() {
  const [phone, setPhone] = useState(isPhone());
  useEffect(() => {
    const m = matchMedia("(max-width: 899px)");
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

export function Sheet(p: { open: boolean; onClose: () => void; title: string; small?: boolean; children: ReactNode }) {
  const phone = usePhone();
  if (phone)
    return (
      <BottomSheet open={p.open} onOpenChange={(o) => !o && p.onClose()} title={p.title} snapPoints={[0.92]} className="sheet">
        <div className="sheetBody">{p.children}</div>
      </BottomSheet>
    );
  return (
    <CenterMorphModal open={p.open} onOpenChange={(o) => !o && p.onClose()}>
      <CenterMorphModalContent ariaLabel={p.title} closeButtonLabel="关闭" className={cn("sheet", p.small ? "max-w-[34rem]" : "max-w-[42rem]")}>
        <div className="sheetHead"><h2>{p.title}</h2></div>
        <div className="sheetBody">{p.children}</div>
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}

export function ConfirmHost() {
  const req = confirmSignal.use();
  const [last, setLast] = useState(req);
  useEffect(() => void (req && setLast(req)), [req]);
  const done = (ok: boolean) => {
    req?.resolve(ok);
    confirmSignal.set(null);
  };
  const r = req ?? last; // keep the words on screen while the dialog folds away
  return (
    <CenterMorphModal open={!!req} onOpenChange={(o) => !o && done(false)}>
      <CenterMorphModalContent ariaLabel={r?.title ?? ""} showCloseButton={false} className="alertDlg max-w-[24rem]">
        {r && (
          <div role="alertdialog" className="p-6">
            <h2 className="serif m-0 text-xl">{r.title}</h2>
            <p className="mt-2 mb-6 text-muted-foreground">{r.body}</p>
            <div className="alertBtns flex justify-end gap-2">
              <Btn kind="ghost" autoFocus onClick={() => done(false)}>{r.cancel ?? "取消"}</Btn>
              <Btn kind="primary" className={r.danger ? "danger bg-destructive text-white hover:bg-destructive/90" : ""} onClick={() => done(true)}>{r.confirm ?? "确定"}</Btn>
            </div>
          </div>
        )}
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
