import type { Card, PublicPlayer } from "../protocol";
import { panel } from "../theme";
import { CardFace } from "./CardFace";

function HiddenCard({ characterId }: { characterId: string }) {
  const fallbackSrc = "/character/defaultBack.jpg";
  return (
    <div
      title="Hidden card"
      style={{
        minWidth: 90,
        height: 130,
        overflow: "hidden",
        background: "#0b1220",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <img
        src={`/character/${encodeURIComponent(characterId)}Back.jpg`}
        onError={(e) => { e.currentTarget.src = fallbackSrc; }}
        alt={`${characterId} card back`}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function OpponentHand({ player }: { player: PublicPlayer }) {
  if (!player.publicHand) {
    return Array.from({ length: player.counts.hand }).map((_, idx) => (
      <HiddenCard key={idx} characterId={player.characterId} />
    ));
  }
  if (player.publicHand.length === 0) {
    return <span style={{ opacity: 0.7, fontSize: 12 }}>{player.name}'s hand is empty</span>;
  }
  return player.publicHand.map((c) => (
    <div key={c.id} style={{ border: "1px solid #475569", borderRadius: 8 }}>
      <CardFace card={c} locked={c.locked} size="sm" />
    </div>
  ));
}

function MyHand({ hand, selectedIds, onToggle }: { hand: Card[]; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  if (hand.length === 0) {
    return <span style={{ opacity: 0.7, fontSize: 12 }}>Your hand is empty</span>;
  }
  return hand.map((c) => (
    <div key={c.id} style={{ border: selectedIds.has(c.id) ? "2px solid #3b82f6" : "1px solid #475569", borderRadius: 8 }}>
      <CardFace card={c} locked={c.locked} onClick={() => onToggle(c.id)} size="sm" />
    </div>
  ));
}

export function HandPanel({
  player,
  viewingSelf,
  canAct,
  hand,
  selectedIds,
  onToggle,
  onDraw,
  onDiscard,
  onPlayEffect,
}: {
  player: PublicPlayer;
  viewingSelf: boolean;
  canAct: boolean;
  hand: Card[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onDraw: () => void;
  onDiscard: () => void;
  onPlayEffect: (card: Card) => void;
}) {
  const selected = hand.filter(c => selectedIds.has(c.id));
  const single = selected.length === 1 ? selected[0] : null;
  const effect = single?.type === "Effect" || single?.type === "Condition" ? single : null;
  //a Condition is the one card meant to be played on someone else's turn
  const canPlayEffect = !!effect && (canAct || effect.type === "Condition");

  return (
    <>
      {/* Header: shows whose hand we’re viewing + counts for that player */}
      <div
        style={{
          ...panel,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: 8,
          marginBottom: 8,
        }}
      >
        {/* LEFT: info */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{viewingSelf ? "Your hand" : `${player.name}'s hand`}</strong>
          <span style={{ marginLeft: 8, opacity: 0.8 }}>Deck: {player.counts.deck}</span>
          <span style={{ opacity: 0.8 }}>· Discard: {player.counts.discard}</span>
        </div>

        <span style={{ marginLeft: "auto" }} />

        {/* Controls appear ONLY when viewing self */}
        {viewingSelf && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onDraw} disabled={!canAct} style={{ marginLeft: 8 }}>
              Draw 1
            </button>
            <button onClick={onDiscard} disabled={!canAct || selected.length === 0}>
              Discard{selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
            <button
              onClick={() => effect && onPlayEffect(effect)}
              disabled={!canPlayEffect}
              title={effect ? "Resolve this effect and discard it" : "Select exactly one effect/condition in your hand"}
            >
              Play Effect
            </button>
          </div>
        )}
      </div>

      {/* Cards area */}
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {viewingSelf
          ? <MyHand hand={hand} selectedIds={selectedIds} onToggle={onToggle} />
          : <OpponentHand player={player} />}
      </div>
    </>
  );
}
