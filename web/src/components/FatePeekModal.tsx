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
    <Modal onClose={onCancel} width="min(860px, 95vw)" maxHeight="80vh">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>Peek top {order.length} — {targetName}</strong>
        <span style={{ opacity: 0.75, fontSize: 12 }}>Top is leftmost</span>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={() => setOrder(cards)} title="Reset order">Reset</button>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onConfirm(order.map(c => c.id))} style={{ marginLeft: 6 }}>
          Confirm Order
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {order.map((c, idx) => (
          <div key={c.id} style={{ position: "relative" }}>
            <CardFace card={c} showCost={false} size="md" />
            {/* order badge */}
            <div style={{
              position: "absolute", top: 6, left: 8, fontSize: 12,
              background: "#1f2937", border: "1px solid #334155", borderRadius: 6, padding: "2px 6px"
            }}>
              #{idx + 1}
            </div>
            {/* controls */}
            <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center" }}>
              <button onClick={() => swap(idx - 1, idx)} title="Move toward top (left)">↑</button>
              <button onClick={() => swap(idx, idx + 1)} title="Move toward bottom (right)">↓</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
