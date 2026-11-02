import type { CSSProperties, ReactNode } from "react";
import { panel } from "../theme";

type ModalProps = {
  onClose: () => void;
  width: string;
  maxHeight?: string;
  zIndex?: number;
  style?: CSSProperties;
  children: ReactNode;
};

//dimmed backdrop and dialog box. Clicking the backdrop closes it
export function Modal({ onClose, width, maxHeight = "75vh", zIndex = 100, style, children }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...panel,
          width,
          maxHeight,
          overflowY: "auto",
          padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
