// Modal sheet (centered on desktop, bottom sheet on phones) and the confirm dialog, both on React Aria.
import type { ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Icon } from "../icons.tsx";
import { confirmSignal } from "../store.tsx";

export function Sheet(p: { open: boolean; onClose: () => void; title: string; small?: boolean; children: ReactNode }) {
  return (
    <ModalOverlay isOpen={p.open} onOpenChange={(o) => !o && p.onClose()} isDismissable className="scrim">
      <Modal className={`sheet ${p.small ? "small" : ""}`}>
        <Dialog className="sheetDialog">
          <div className="sheetHead">
            <span />
            <Heading slot="title">{p.title}</Heading>
            <Button className="icon" slot="close" aria-label="关闭">
              <Icon name="close" />
            </Button>
          </div>
          <div className="sheetBody">{p.children}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function ConfirmHost() {
  const req = confirmSignal.use();
  const done = (ok: boolean) => {
    req?.resolve(ok);
    confirmSignal.set(null);
  };
  return (
    <ModalOverlay isOpen={!!req} onOpenChange={(o) => !o && done(false)} isDismissable className="alertWrap">
      <Modal className="alertDlg">
        <Dialog role="alertdialog">
          {req && (
            <>
              <Heading slot="title" className="serif">{req.title}</Heading>
              <p>{req.body}</p>
              <div className="alertBtns">
                <Button className="ghost" autoFocus onPress={() => done(false)}>{req.cancel ?? "取消"}</Button>
                <Button className={`primary ${req.danger ? "danger" : ""}`} onPress={() => done(true)}>{req.confirm ?? "确定"}</Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
