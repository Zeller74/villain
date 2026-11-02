import type { PublicPlayer } from "../protocol";

export function DiscardPeek({
  player,
  viewingSelf,
  onOpen,
  onReshuffle,
}: {
  player: PublicPlayer;
  viewingSelf: boolean;
  onOpen: () => void;
  onReshuffle?: (() => void) | undefined;
}) {
  const count = player.counts.discard;
  const topLabel = player.discardTop?.label ?? "—";

  return (
    <div className="discard-peek">
      <strong>{viewingSelf ? "Your" : `${player.name}'s`} discard</strong>
      <span>({count})</span>
      <span className="discard-peek__top" title={topLabel}>Top: {topLabel}</span>
      <button onClick={onOpen} disabled={count === 0}>Open Discard</button>
      {onReshuffle && (
        <button
          onClick={onReshuffle}
          disabled={count === 0}
          title={count === 0 ? "Discard is empty" : "Shuffle discard into deck"}
        >
          Shuffle Discard
        </button>
      )}
    </div>
  );
}
