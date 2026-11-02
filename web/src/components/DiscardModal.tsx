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
    <Modal onClose={onClose} width="min(720px, 90vw)">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Discard pile ({cards.length})</strong>
        {canTake && <span style={{ fontSize: 12, opacity: 0.75 }}>Click a card to add to your hand</span>}
        <span style={{ marginLeft: "auto" }} />
        <button onClick={onClose}>Close</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {cards.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Empty</div>
        ) : (
          cards.map((c) => (
            <CardFace
              key={c.id}
              card={c}
              locked={c.locked}
              size="sm"
              onClick={canTake ? () => onTakeCard(c) : undefined}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
