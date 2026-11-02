import { useState } from "react";
import type { Card } from "../protocol";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

export function FatePeekModal({
  targetName,
  cards,
  onCancel,
  onConfirm,
}: {
  targetName: string;
  cards: Card[];
  onCancel: () => void;
  onConfirm: (orderIds: string[]) => void;
}) {
  const [order, setOrder] = useState(cards);

  const swap = (a: number, b: number) => {
    if (a < 0 || b >= order.length) return;
    const next = order.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
  };

  return (
    <Modal onClose={onCancel} size="wide">
      <div className="modal__head">
        <strong>Peek top {order.length} — {targetName}</strong>
        <span className="modal__hint">Top is leftmost</span>
        <span className="modal__spacer" />
        <button onClick={() => setOrder(cards)} title="Reset order">Reset</button>
        <button onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => onConfirm(order.map(c => c.id))}>Confirm Order</button>
      </div>

      <div className="modal__row">
        {order.map((c, idx) => (
          <div key={c.id} className="peek-card">
            <CardFace card={c} />
            <div className="peek-card__controls">
              <button onClick={() => swap(idx - 1, idx)} title="Move toward top (left)">↑</button>
              <span>#{idx + 1}</span>
              <button onClick={() => swap(idx, idx + 1)} title="Move toward bottom (right)">↓</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
