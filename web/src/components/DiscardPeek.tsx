import type { PublicPlayer } from "../protocol";

export function DiscardPeek({
  player,
  myId,
  onOpen,
  onReshuffle,
}: {
  player: PublicPlayer | null;
  myId: string | null;
  onOpen: () => void;
  onReshuffle?: () => void;
}) {
  const count = player?.counts?.discard ?? 0;
  const topLabel = player?.discardTop?.label ?? "—";
  const ownerLabel = player
    ? (myId && player.id === myId ? "Your" : `${player.name}'s`)
    : "Discard";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 8,
        background: "#111827",
        color: "#e5e7eb",
        marginBottom: 8,
      }}
    >
      <strong>{ownerLabel} discard</strong>
      <span style={{ opacity: 0.8 }}>({count})</span>

      <span style={{ marginLeft: 8, opacity: 0.8 }}>Top:</span>
      <span
        style={{
          border: "1px solid #475569",
          borderRadius: 6,
          padding: "4px 6px",
          background: "#1f2937",
        }}
      >
        {topLabel}
      </span>

      <span style={{ marginLeft: "auto" }} />
      <button onClick={onOpen} disabled={count === 0}>
        Open Discard
      </button>
      {typeof onReshuffle === "function" && (
        <button
          onClick={onReshuffle}
          disabled={count === 0}
          title={count === 0 ? "Discard is empty" : "Shuffle discard into deck"}
          style={{ marginRight: 6 }}
        >
          Shuffle Discard
        </button>
      )}
    </div>
  );
}
