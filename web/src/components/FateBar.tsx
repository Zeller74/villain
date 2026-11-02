import { useState } from "react";
import type { PublicPlayer } from "../protocol";
import { panel } from "../theme";
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
    <div
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      {/* LEFT: info */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate</strong>
        <span style={{ opacity: 0.85 }}>Deck: {fateDeck}</span>
        <span style={{ opacity: 0.85 }}>· Discard: {fateDiscard}</span>
        {!viewingSelf && (
          <span style={{ opacity: 0.6 }}>· Target: {focusPlayer.name}</span>
        )}
      </div>

      <span style={{marginLeft: "auto"}}/>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={() => setPickOpen(true)}
          disabled={!canFate}
          title={canFate ? "Choose a player to Fate" : "Your turn required"}
        >
          Fate…
        </button>
      </div>
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
