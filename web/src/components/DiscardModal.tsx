import type { Card } from "../protocol";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

export function DiscardModal({
  cards,
  onClose,
  canTake,
  onTakeCard,
}: {
  cards: Card[];
  onClose: () => void;
  canTake: boolean;
  onTakeCard: (card: Card) => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="modal__head">
        <strong>Discard pile ({cards.length})</strong>
        {canTake && <span className="modal__hint">Click a card to add to your hand</span>}
        <button className="modal__spacer" onClick={onClose}>Close</button>
      </div>

      {cards.length === 0 ? (
        <div className="modal__empty">Empty</div>
      ) : (
        <div className="modal__grid">
          {cards.map((c) => (
            <CardFace
              key={c.id}
              card={c}
              locked={c.locked}
              size="sm"
              onClick={canTake ? () => onTakeCard(c) : undefined}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
