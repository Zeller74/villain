import { useEffect } from "react";
import type { Card } from "../protocol";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

//a card at the size of the window. A click anywhere closes it, as the card lets clicks through to the backdrop
export function CardZoom({ card, onClose }: { card: Card; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <Modal onClose={onClose} onTop boxClassName="card-zoom">
      <CardFace card={card} size="zoom" />
      <button className="card-zoom__close" onClick={onClose} autoFocus>Close</button>
    </Modal>
  );
}
