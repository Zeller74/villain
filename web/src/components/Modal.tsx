import type { ReactNode } from "react";
import { cx } from "../cx";

type ModalProps = {
  onClose: () => void;
  size?: "narrow" | "medium" | "wide";
  onTop?: boolean;
  boxClassName?: string;
  children: ReactNode;
};

//dimmed backdrop and dialog box. Clicking the backdrop closes it
export function Modal({ onClose, size, onTop = false, boxClassName, children }: ModalProps) {
  return (
    <div role="dialog" aria-modal="true" className={cx("modal", onTop && "modal--top")} onClick={onClose}>
      <div
        className={cx("modal__box frame", size && `modal__box--${size}`, boxClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
