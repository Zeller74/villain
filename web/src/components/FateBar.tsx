import { useState } from "react";
import type { PublicPlayer } from "../protocol";
import { PlayerPickerModal } from "./PlayerPickerModal";

export function FateBar({
  focusPlayer,
  viewingSelf,
  canAct,
  opponents,
  onStartFate,
  onReshuffleFate,
  onOpenFateDiscard,
}: {
  focusPlayer: PublicPlayer;
  viewingSelf: boolean;
  canAct: boolean;
  opponents: PublicPlayer[];
  onStartFate: (targetId: string) => void;
  onReshuffleFate: (playerId: string) => void;
  onOpenFateDiscard: (playerId: string) => void;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const {fateDeck, fateDiscard} = focusPlayer.counts;

  const canFate = canAct && viewingSelf;
  const disabledReason = !canAct ? "Not your turn" : (!viewingSelf ? "Switch to your board to act" : undefined);

  return (
    <div className="fate-bar">
      <div className="fate-bar__info">
        <strong>Fate</strong>
        <span>Deck: {fateDeck}</span>
        <span>· Discard: {fateDiscard}</span>
        {!viewingSelf && <span>· Target: {focusPlayer.name}</span>}
      </div>

      <button
        onClick={() => setPickOpen(true)}
        disabled={!canFate}
        title={canFate ? "Choose a player to Fate" : "Your turn required"}
      >
        Fate…
      </button>
      {pickOpen && (
        <PlayerPickerModal
          title="Choose a player to Fate"
          players={opponents}
          onClose={() => setPickOpen(false)}
          onPick={(targetId) => {
            onStartFate(targetId);
            setPickOpen(false);
          }}
        />
      )}

      {/* View fate discard (of the focused player) */}
      <button onClick={() => onOpenFateDiscard(focusPlayer.id)} title="View fate discard">
        Open Discard
      </button>

      {/* Reshuffle (for the focused player) */}
      <button
        onClick={() => onReshuffleFate(focusPlayer.id)}
        disabled={!canFate || fateDiscard === 0}
        title={
          !canFate
            ? (disabledReason || "Disabled")
            : (fateDiscard === 0 ? "Fate discard is empty" : "Shuffle fate discard into fate deck")
        }
      >
        Shuffle Discard
      </button>
    </div>
  );
}
