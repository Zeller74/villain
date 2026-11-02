import type { Card } from "../protocol";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

export function FateSiftModal({
  cards,
  targetName,
  onDiscardOne,
  onClose,
}: {
  cards: Card[];
  targetName: string;
  onDiscardOne: (discardId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} size="medium">
      <div className="modal__head">
        <strong>Fate Sift — {targetName}</strong>
        <button className="modal__spacer" onClick={onClose}>Cancel</button>
      </div>

      <p className="modal__hint">
        Choose <em>one</em> card to discard. The other will be returned face down on top.
      </p>

      <div className="modal__row sift">
        {cards.map((c, idx) => (
          <div key={c.id} className="sift__card">
            <span className="label">{idx === 0 ? "Top (1)" : "Next (2)"}</span>
            <CardFace
              card={c}
              onClick={() => onDiscardOne(c.id)}
              title="Discard this card (the other goes on top)"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
