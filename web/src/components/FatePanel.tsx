import type { Card } from "../protocol";
import { panel } from "../theme";
import { CardFace } from "./CardFace";

export function FatePanel({
  cards,
  onPlay,
  onCancel,
  onDiscardBoth,
  onDiscardSelected,
}: {
  cards: Card[];
  onPlay: (card: Card) => void;
  onCancel: () => void;
  onDiscardBoth: () => void;
  onDiscardSelected: () => void;
}) {
  return (
    <div style={{ ...panel, padding: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate: choose a card to play</strong>
        <span style={{ marginLeft: "auto" }} />
        {cards.length >= 2 ? (
          <button
            onClick={onDiscardBoth}
            title="Send both revealed fate cards to discard"
            style={{ marginLeft: 6 }}
          >
            Discard Both
          </button>
        ) : (
          <button onClick={onDiscardSelected} title="Discard this card instead of playing it">
            Discard
          </button>
        )}
        <button onClick={onCancel}>Cancel</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {cards.map((c) => (
          <CardFace key={c.id} card={c} showCost={false} size="md" onClick={() => onPlay(c)} />
        ))}
      </div>
    </div>
  );
}

export function FatePlaceBanner({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div
      style={{
        border: "1px dashed #3b82f6",
        borderRadius: 10,
        padding: 8,
        background: "#0b1220",
        color: "#e5e7eb",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>Placing <strong>{label}</strong>: click a location <em>Top</em> on the target’s board.</span>
      <span style={{ marginLeft: "auto" }} />
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
