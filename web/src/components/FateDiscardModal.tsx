import { useState } from "react";
import type { Card } from "../protocol";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

export function FateDiscardModal({
  cards,
  targetName,
  canAct,
  onClose,
  onTake,
  onReturnSelected,
}: {
  cards: Card[];
  targetName: string;
  canAct: boolean;
  onClose: () => void;
  onTake: (card: Card) => void;
  onReturnSelected: (card: Card) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find(c => c.id === selectedId) ?? null;

  return (
    <Modal onClose={onClose}>
      <div className="modal__head">
        <strong>Fate discard — {targetName} ({cards.length})</strong>
        <span className="modal__spacer" />
        {canAct && (
          <>
            <button
              onClick={() => selected && onTake(selected)}
              disabled={!selected}
              title={selected ? "Play selected fate card" : "Select a card first"}
            >
              Play
            </button>
            <button
              onClick={() => selected && onReturnSelected(selected)}
              disabled={!selected}
              title={selected ? "Return selected card to fate deck (reshuffle)" : "Select a card first"}
            >
              Return to Deck
            </button>
          </>
        )}
        <button onClick={onClose}>Close</button>
      </div>

      {cards.length === 0 ? (
        <div className="modal__empty">Empty</div>
      ) : (
        <div className="modal__grid">
          {cards.map((c) => (
            <CardFace
              key={c.id}
              card={c}
              size="sm"
              active={c.id === selectedId}
              onClick={() => setSelectedId(c.id)}
              title="Select this card"
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
