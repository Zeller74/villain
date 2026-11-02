import { useState } from "react";
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
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <Modal onClose={onClose} width="min(560px, 90vw)" maxHeight="70vh">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate Sift — {targetName}</strong>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={onClose}>Cancel</button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
        Choose <em>one</em> card to discard. The other will be returned face down on top.
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        {cards.map((c, idx) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId(null)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDiscardOne(c.id); }}
            onClick={() => onDiscardOne(c.id)}
            title="Discard this card (the other goes on top)"
            style={{
              position: "relative",
              cursor: "pointer",
              border: "1px solid " + (hoverId === c.id ? "#60a5fa" : "#475569"),
              boxShadow: hoverId === c.id ? "0 0 0 2px rgba(96,165,250,.35)" : "none",
              borderRadius: 8,
              padding: 6,
              transition: "box-shadow .12s ease, border-color .12s ease",
            }}
          >
            <div style={{ position: "absolute", top: 6, left: 8, fontSize: 11, opacity: 0.7 }}>
              {idx === 0 ? "Top (1)" : "Next (2)"}
            </div>
            <CardFace card={c} showCost={false} size="md" />
          </div>
        ))}
      </div>
    </Modal>
  );
}
