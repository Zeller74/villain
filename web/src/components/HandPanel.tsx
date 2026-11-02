import { cx } from "../cx";
import type { Card, PublicPlayer } from "../protocol";
import { CardFace } from "./CardFace";

const FALLBACK_BACK = "/character/defaultBack.jpg";

export function CardBack({ characterId, title = "Hidden card" }: { characterId: string; title?: string }) {
  return (
    <span className="card-back" title={title}>
      <img
        src={`/character/${encodeURIComponent(characterId)}Back.jpg`}
        onError={(e) => { e.currentTarget.src = FALLBACK_BACK; }}
        alt={`${characterId} card back`}
        draggable={false}
      />
    </span>
  );
}

function OpponentHand({ player }: { player: PublicPlayer }) {
  if (!player.publicHand) {
    return Array.from({ length: player.counts.hand }).map((_, idx) => (
      <div key={idx} className="slot">
        <CardBack characterId={player.characterId} />
      </div>
    ));
  }
  if (player.publicHand.length === 0) {
    return <span className="hand__empty">{player.name}'s hand is empty</span>;
  }
  return player.publicHand.map((c) => (
    <div key={c.id} className="slot">
      <CardFace card={c} locked={c.locked} />
    </div>
  ));
}

function MyHand({ hand, selectedIds, onToggle }: { hand: Card[]; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  if (hand.length === 0) {
    return <span className="hand__empty">Your hand is empty</span>;
  }
  return hand.map((c) => (
    <div key={c.id} className={cx("slot", selectedIds.has(c.id) && "is-selected")}>
      <CardFace card={c} locked={c.locked} onClick={() => onToggle(c.id)} />
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
  const hidden = !viewingSelf && !player.publicHand;

  return (
    <>
      <div className="hand-bar">
        <div className="hand-bar__info">
          <strong>{viewingSelf ? "Your hand" : `${player.name}'s hand`}</strong>
          <span>Deck: {player.counts.deck}</span>
          <span>· Discard: {player.counts.discard}</span>
        </div>

        {viewingSelf && (
          <div className="hand-bar__controls">
            <button onClick={onDraw} disabled={!canAct}>Draw 1</button>
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

      <div className={cx("fan hand", hidden && "hand--hidden")}>
        {viewingSelf
          ? <MyHand hand={hand} selectedIds={selectedIds} onToggle={onToggle} />
          : <OpponentHand player={player} />}
      </div>
    </>
  );
}
