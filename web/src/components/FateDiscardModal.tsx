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
    <Modal onClose={onClose} width="min(720px, 90vw)">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate discard — {targetName} ({cards.length})</strong>
        <span style={{ marginLeft: "auto" }} />
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {cards.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Empty</div>
        ) : cards.map((c, idx) => (
          <div
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            title="Select this card"
            style={{
              cursor: "pointer",
              border: c.id === selectedId ? "2px solid #3b82f6" : "1px solid #475569",
              borderRadius: 8, background: "#1f2937", color: "#f1f5f9",
              minWidth: 100, height: 140, padding: 8,
              position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ position: "absolute", top: 6, left: 8, fontSize: 11, opacity: 0.6 }}>
              #{cards.length - idx}
            </div>
            {/* Fate cards: no cost, no lock/± */}
            <CardFace card={c} showCost={false} size="sm" />
          </div>
        ))}
      </div>
    </Modal>
  );
}
