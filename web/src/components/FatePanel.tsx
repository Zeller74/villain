import type { Card } from "../protocol";
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
    <div className="fate-panel">
      <div className="fate-panel__head">
        <strong>Fate: choose a card to play</strong>
        <div>
          {cards.length >= 2 ? (
            <button onClick={onDiscardBoth} title="Send both revealed fate cards to discard">
              Discard Both
            </button>
          ) : (
            <button onClick={onDiscardSelected} title="Discard this card instead of playing it">
              Discard
            </button>
          )}
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>

      <div className="fate-panel__cards">
        {cards.map((c) => (
          <CardFace key={c.id} card={c} onClick={() => onPlay(c)} />
        ))}
      </div>
    </div>
  );
}

export function FatePlaceBanner({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="notice">
      <span>Placing <strong>{label}</strong>: click a location <em>Top</em> on the target’s board.</span>
      <div className="notice__actions">
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
