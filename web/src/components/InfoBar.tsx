import type { Phase, PublicPlayer } from "../protocol";
import { panel } from "../theme";
import { GuideButton } from "./GuideButton";

export function InfoBar({
  focusPlayer,
  viewingSelf,
  canAct,
  phase,
  characterName,
  onChangePower,
}: {
  focusPlayer: PublicPlayer;
  viewingSelf: boolean;
  canAct: boolean;
  phase: Phase;
  characterName: string;
  onChangePower: (delta: number) => void;
}) {
  const leftTitle = viewingSelf
    ? characterName
    : `Viewing: ${focusPlayer.name} (${characterName})`;
  const statusText =
    phase !== "playing"
      ? "Ended"
      : canAct
        ? (viewingSelf ? "Your turn" : "Your turn (spectating)")
        : "Waiting…";

  return (
    <div
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <strong style={{ whiteSpace: "nowrap" }}>{leftTitle}</strong>
      <GuideButton characterId={focusPlayer.characterId} />
      <span style={{ opacity: 0.8 }}>Pawn: L{focusPlayer.board.moverAt + 1}</span>
      <span style={{ opacity: 0.8 }}>Power: {focusPlayer.power}</span>

      <div style={{ display: "flex", alignItems: "center", minHeight: 40}}>
        {viewingSelf && canAct && phase === "playing" ? (
          <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
            <button onClick={() => onChangePower(-1)}>-1</button>
            <button onClick={() => onChangePower(+1)}>+1</button>
          </div>
        ) : (
          <div style={{ height: 30, marginLeft: 6, visibility: "hidden" }}>
            <button>-1</button><button>+1</button>
          </div>
        )}
      </div>
      <span style={{ marginLeft: "auto", opacity: 0.8 }}>{statusText}</span>
    </div>
  );
}
